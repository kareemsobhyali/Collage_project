import { api, getFullImageUrl } from './api';

// نظام تنبيهات صوتية ذكي وموحد: يشغل الصوت المخصص بنقاء وتكرار بدون تداخل، مع دعم Web Audio API التخليقي
class SoundNotifier {
  private audioCtx: AudioContext | null = null;
  private intervalId: any = null;
  private isMuted: boolean = false;
  private customAudioUrl: string | null = null;
  private customVolume: number = 1.0;
  private activeAudio: HTMLAudioElement | null = null;

  constructor() {
    this.setupUserGestureUnlock();
    this.fetchAndApplySettings();
  }

  public setCustomSound(soundUrl: string | null, volume: number = 1.0) {
    if (soundUrl) {
      this.customAudioUrl = getFullImageUrl(soundUrl);
      this.customVolume = volume;
    } else {
      this.customAudioUrl = null;
    }
  }

  public async fetchAndApplySettings() {
    try {
      const data = await api.getPublicSoundSettings();
      if (data && data.enabled && data.soundUrl) {
        this.setCustomSound(data.soundUrl, data.volume ?? 1.0);
      } else {
        this.setCustomSound(null);
      }
    } catch (_e) {}
  }

  // فك حظر تشغيل الصوت تلقائياً فور أول تفاعل من المستخدم مع الصفحة
  private setupUserGestureUnlock() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      this.initCtx();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
  }

  public initCtx() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    } catch (_e) {}
  }

  // عزف النغمة التخليقية الثنائية
  public playSyntheticChime() {
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // النغمة الأولى (عالية)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.3 * this.customVolume, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // النغمة الثانية (أعلى بعد 150 ملي ثانية)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.15); // D6
      gain2.gain.setValueAtTime(0.4 * this.customVolume, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn('Sound play error:', e);
    }
  }

  // تشغيل تنبيه متكرر ذكي: يشغل الصوت المخصص عبر loop نظيف يمنع تكرار/تداخل الصوت مع نفسه
  public startRepeatingAlarm() {
    this.stopRepeatingAlarm();
    if (this.isMuted) return;

    if (this.customAudioUrl) {
      try {
        const audio = new Audio(this.customAudioUrl);
        audio.volume = this.customVolume;
        audio.loop = true; // تكرار تلقائي نظيف لنفس الملف الصوتي
        this.activeAudio = audio;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // في حال منع المتصفح تشغيل الملف الصوتي المخصص، نلجأ للرنين التخليقي
            this.startSyntheticLoop();
          });
        }
        return;
      } catch (_e) {
        // Fallback
      }
    }

    this.startSyntheticLoop();
  }

  private startSyntheticLoop() {
    this.playSyntheticChime();
    this.intervalId = setInterval(() => {
      this.playSyntheticChime();
    }, 2500);
  }

  // إيقاف التنبيه الصوتي فوراً وبشكل قاطع
  public stopRepeatingAlarm() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (_e) {}
      this.activeAudio = null;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopRepeatingAlarm();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const soundNotifier = new SoundNotifier();
