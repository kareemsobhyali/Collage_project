// ── Order Tracker Client Logic ───────────────────────────────────────────────

(function() {
    // 1. Extract Order Identifier from URL path (/order/188) or query param (?id=188)
    function getOrderIdentifier() {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2 && pathParts[0] === 'order') {
            return pathParts[1];
        }
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id') || urlParams.get('order_id') || '0';
    }

    const orderId = getOrderIdentifier(); // IH_SERIAL from URL (/order/{IH_SERIAL})
    let displayedOrderCode = '';          // Customer-facing ih_code from DB
    let isOrderReady = false;
    let wakeLock = null;
    let connectedIhId = null;
    let sharedAudioCtx = null;
    let chimeAudioEl = null;
    let repeatAlarmTimer = null;
    let soundUnlocked = false;

    // DOM Elements
    const heroCard = document.getElementById('heroCard');
    const orderNumberEl = document.getElementById('orderNumber');
    const branchNameEl = document.getElementById('branchName');
    const orderTypeBadge = document.getElementById('orderTypeBadge');
    const statusEmoji = document.getElementById('statusEmoji');
    const statusTitle = document.getElementById('statusTitle');
    const statusDesc = document.getElementById('statusDesc');
    const progressBar = document.getElementById('progressBar');
    const itemsListEl = document.getElementById('itemsList');
    const itemsCountEl = document.getElementById('itemsCount');
    const totalAmountEl = document.getElementById('totalAmount');
    const readyModal = document.getElementById('readyModal');
    const modalOrderNum = document.getElementById('modalOrderNum');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const pushPromptBanner = document.getElementById('pushPromptBanner');
    const enablePushBtn = document.getElementById('enablePushBtn');
    const pushIcon = document.getElementById('pushIcon');
    const pushTitle = document.getElementById('pushTitle');
    const pushDesc = document.getElementById('pushDesc');

    // ── Generate In-Memory WAV Data URI for reliable mobile <audio> playback ──
    function createChimeWavDataUri() {
        const sampleRate = 22050;
        const durationSec = 1.2;
        const numSamples = Math.floor(sampleRate * durationSec);
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);

        function writeStr(offset, str) {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        }

        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, 'data');
        view.setUint32(40, numSamples * 2, true);

        // 3-note bright bell chime: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
        const notes = [
            { freq: 587.33, start: 0.0, end: 0.25 },
            { freq: 783.99, start: 0.20, end: 0.50 },
            { freq: 987.77, start: 0.40, end: 0.75 },
            { freq: 1174.66, start: 0.60, end: 1.20 }
        ];

        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            let sample = 0;
            for (const n of notes) {
                if (t >= n.start && t <= n.end) {
                    const localT = t - n.start;
                    const env = Math.exp(-3.5 * localT);
                    sample += 0.45 * env * (
                        Math.sin(2 * Math.PI * n.freq * localT) +
                        0.3 * Math.sin(2 * Math.PI * n.freq * 2 * localT)
                    );
                }
            }
            sample = Math.max(-1, Math.min(1, sample));
            view.setInt16(44 + i * 2, sample * 32767, true);
        }

        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return 'data:audio/wav;base64,' + btoa(binary);
    }

    function ensureAudioReady() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext && !sharedAudioCtx) {
                sharedAudioCtx = new AudioContext();
            }
            if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
                sharedAudioCtx.resume();
            }
            if (!chimeAudioEl) {
                chimeAudioEl = new Audio(createChimeWavDataUri());
                chimeAudioEl.preload = 'auto';
            }
        } catch (e) {
            console.warn('Audio init warning:', e);
        }
    }

    // ── Screen Wake Lock (Keeps iPhone / Android screen on while waiting) ─────
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen Wake Lock is active.');
            } catch (err) {
                console.log(`Wake Lock error: ${err.name}, ${err.message}`);
            }
        }
    }

    // ── Play Chime Sound (Both HTML5 Audio + WebAudio API for maximum volume) ─
    function playChimeSound(isShortConfirmation) {
        try {
            ensureAudioReady();

            if (!isShortConfirmation && chimeAudioEl) {
                chimeAudioEl.currentTime = 0;
                chimeAudioEl.play().catch(e => console.warn('HTML5 audio play blocked:', e));
            }

            if (sharedAudioCtx) {
                if (sharedAudioCtx.state === 'suspended') {
                    sharedAudioCtx.resume();
                }

                function playTone(freq, startTime, duration, vol) {
                    const osc = sharedAudioCtx.createOscillator();
                    const gain = sharedAudioCtx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, startTime);

                    gain.gain.setValueAtTime(vol || 0.5, startTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

                    osc.connect(gain);
                    gain.connect(sharedAudioCtx.destination);

                    osc.start(startTime);
                    osc.stop(startTime + duration);
                }

                const now = sharedAudioCtx.currentTime;
                if (isShortConfirmation) {
                    // Quick pleasant double-beep confirming sound is unlocked
                    playTone(659.25, now, 0.15, 0.25);
                    playTone(880.00, now + 0.12, 0.25, 0.30);
                } else {
                    // Loud 4-tone notification bell
                    playTone(587.33, now, 0.35, 0.6);
                    playTone(783.99, now + 0.18, 0.35, 0.6);
                    playTone(987.77, now + 0.36, 0.45, 0.6);
                    playTone(1174.66, now + 0.54, 0.70, 0.7);
                }
            }
        } catch (e) {
            console.warn('Audio playback error:', e);
        }
    }

    // ── Vibration API ────────────────────────────────────────────────────────
    function triggerVibration() {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate([500, 200, 500, 200, 800]);
            } catch (e) {}
        }
    }

    // ── Stop Repeating Alarm when customer dismisses modal ───────────────────
    function stopRepeatingAlarm() {
        if (repeatAlarmTimer) {
            clearInterval(repeatAlarmTimer);
            repeatAlarmTimer = null;
        }
    }

    // ── Transition UI to READY state ─────────────────────────────────────────
    function markUIAsReady(code) {
        if (code) {
            displayedOrderCode = String(code);
            orderNumberEl.textContent = '#' + displayedOrderCode;
        }
        if (isOrderReady) return;
        isOrderReady = true;

        const visibleCode = displayedOrderCode || '---';

        heroCard.classList.remove('preparing');
        heroCard.classList.add('ready');

        statusEmoji.textContent = '🔔';
        statusTitle.textContent = 'طلبك جاهز للاستلام الآن!';
        statusDesc.textContent = 'تفضل بالتوجه لشباك التسليم لاستلام طلبك ساخناً وطازجاً 👍';
        progressBar.style.width = '100%';

        modalOrderNum.textContent = '#' + visibleCode;
        readyModal.style.display = 'flex';

        // Play immediately + repeat every 2.5 seconds until user taps button
        playChimeSound(false);
        triggerVibration();

        // Also show system notification if granted
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('ديفادو - طلبك جاهز! 🔔', {
                    body: `طلبك رقم #${visibleCode} جاهز للاستلام الآن!`,
                    vibrate: [500, 200, 500]
                });
            } catch (e) {}
        }

        let rings = 0;
        repeatAlarmTimer = setInterval(() => {
            rings++;
            if (rings > 15) {
                stopRepeatingAlarm();
                return;
            }
            playChimeSound(false);
            triggerVibration();
        }, 2500);
    }

    // ── Fetch Order Details ──────────────────────────────────────────────────
    async function loadOrderData() {
        try {
            const resp = await fetch(`/api/customer-orders/${orderId}`);
            if (!resp.ok) return;
            const data = await resp.json();

            // Set Header and Badges: Always display ih_code (data.order_code) to the customer, never IH_SERIAL
            if (data.order_code) {
                displayedOrderCode = String(data.order_code);
                orderNumberEl.textContent = '#' + displayedOrderCode;
                if (isOrderReady) {
                    modalOrderNum.textContent = '#' + displayedOrderCode;
                }
            }
            if (data.branch_name) branchNameEl.textContent = data.branch_name;
            if (data.order_type) orderTypeBadge.textContent = data.order_type;

            // Render Items
            if (data.items && data.items.length > 0) {
                itemsCountEl.textContent = `${data.items.length} أصناف`;
                itemsListEl.innerHTML = '';
                data.items.forEach(item => {
                    const row = document.createElement('div');
                    row.className = 'item-row';
                    row.innerHTML = `
                        <div class="item-left">
                            <span class="item-qty">${item.qty || 1}×</span>
                            <span class="item-name">${item.name || item.item_name || ''}</span>
                        </div>
                        <span class="item-price">${(item.price || 0).toFixed(2)} ج.م</span>
                    `;
                    itemsListEl.appendChild(row);
                });
            } else {
                itemsListEl.innerHTML = '<div class="empty-items">جاري تجهيز الأصناف في المطبخ...</div>';
            }

            if (data.total_amount) {
                totalAmountEl.textContent = `${data.total_amount.toFixed(2)} ج.م`;
            }

            if (data.is_ready || data.status === 'READY') {
                markUIAsReady(data.order_code);
            }

            // Also connect WebSocket by internal ih_id if customer opened URL by order_code
            if (data.ih_id && String(data.ih_id) !== String(orderId) && connectedIhId !== data.ih_id) {
                connectedIhId = data.ih_id;
                connectLiveWebSocket(data.ih_id);
            }

        } catch (e) {
            console.error('Failed to load order:', e);
        }
    }

    // ── Live WebSocket Connection ────────────────────────────────────────────
    function connectLiveWebSocket(targetId) {
        const wsTarget = targetId || orderId;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/customer-orders/ws/${wsTarget}`;
        let ws;

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('Connected to live order updates WebSocket:', wsTarget);
                setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send('ping');
                }, 25000);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log('WS Message received:', msg);
                    if (msg.event === 'ORDER_READY' || msg.status === 'READY') {
                        markUIAsReady(msg.order_code);
                    }
                } catch (e) {
                    console.error('Failed to parse WS message:', e);
                }
            };

            ws.onclose = () => {
                if (!isOrderReady) {
                    setTimeout(() => connectLiveWebSocket(wsTarget), 3000);
                }
            };

            ws.onerror = () => {
                ws.close();
            };
        } catch (e) {
            if (!isOrderReady) {
                setTimeout(() => connectLiveWebSocket(wsTarget), 5000);
            }
        }
    }

    // ── Sound & Push Activation ──────────────────────────────────────────────
    async function activateSoundAndPush(playConfirmBeep) {
        ensureAudioReady();
        requestWakeLock();

        if (!soundUnlocked) {
            soundUnlocked = true;
            if (playConfirmBeep) {
                playChimeSound(true);
            }
            if (pushIcon) pushIcon.textContent = '✅';
            if (pushTitle) pushTitle.textContent = 'التنبيه الصوتي مفعّل بنجاح';
            if (pushDesc) pushDesc.textContent = 'سيرن هاتفك بصوت واضح ويهتز فور جاهزية طلبك.';
            if (enablePushBtn) {
                enablePushBtn.textContent = 'تجربة الصوت 🔊';
            }
        } else if (playConfirmBeep) {
            // Allow user to test the full chime sound by tapping the button again
            playChimeSound(false);
            triggerVibration();
        }

        // Try Web Push if supported (HTTPS)
        if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    const reg = await navigator.serviceWorker.register('/static/tracker/sw.js');
                    const subscription = await reg.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: 'BCA5gn4kKeElPmffcMOmQMRKuXDaM2X3ZS4e5ZCgQmifpoK9q_LJ_axDRaiMVtrTahsdZwNkJN2UMlyy1sSrUQo'
                    });
                    await fetch(`/api/customer-orders/${orderId}/push-subscribe`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subscription: subscription.toJSON() })
                    });
                }
            } catch (err) {
                console.log('Web Push optional setup skipped:', err.message);
            }
        }
    }

    // Modal Close
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            stopRepeatingAlarm();
            readyModal.style.display = 'none';
        });
    }

    // Initialize
    window.addEventListener('DOMContentLoaded', () => {
        loadOrderData();
        connectLiveWebSocket();

        if (enablePushBtn) {
            enablePushBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                activateSoundAndPush(true);
            });
        }

        // Poll every 3 seconds as a rock-solid fallback for live items & status updates
        setInterval(() => {
            if (!isOrderReady) {
                loadOrderData();
            }
        }, 3000);

        // Unlock audio automatically on ANY first touch or scroll on mobile
        const unlockOnGesture = () => {
            activateSoundAndPush(false);
            document.removeEventListener('touchstart', unlockOnGesture);
            document.removeEventListener('click', unlockOnGesture);
        };
        document.addEventListener('touchstart', unlockOnGesture, { passive: true });
        document.addEventListener('click', unlockOnGesture, { once: true });
    });

})();
