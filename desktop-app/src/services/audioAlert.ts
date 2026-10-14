import { api, getFullImageUrl } from './api';

// نظام تنبيهات صوتية ذكي: يشغل الصوت المخصص المرفوع من لوحة تحكم الإدارة، مع دعم احتياطي لنغمة Web Audio API التخليقية
class SoundNotifier {
  private audioCtx: AudioContext | null = null;
  private intervalId: any = null;
  private isMuted: boolean = false;
  private customAudioUrl: string | null = null;
  private customVolume: number = 1.0;

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

  // فك حظر تشغيل الصوت تلقائياً فور أول تفاعل من المستخدم مع الصفحة امتثالاً لسياسة المتصفحات الصارمة
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
  private playSyntheticChime() {
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

      // النغمة الثانية (أعلى وأقوى بعد 150 ملي ثانية)
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
      console.warn("Sound play error:", e);
    }
  }

  // عزف النغمة المخصصة أو الاحتياطية
  private playChime() {
    if (this.isMuted) return;

    if (this.customAudioUrl) {
      try {
        const audio = new Audio(this.customAudioUrl);
        audio.volume = this.customVolume;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((_err) => {
            // في حال منع المتصفح تشغيل ملف الصوت المخصص، نلجأ فوراً لـ Web Audio API التخليقي
            this.playSyntheticChime();
          });
        }
        return;
      } catch (_e) {
        // Fallback
      }
    }

    this.playSyntheticChime();
  }

  // تشغيل تنبيه متكرر لا يتوقف حتى يقوم الكاشير بالاستجابة
  public startRepeatingAlarm() {
    this.stopRepeatingAlarm();
    this.playChime();
    this.intervalId = setInterval(() => {
      this.playChime();
    }, 2000); // تكرار كل ثانيتين
  }

  public stopRepeatingAlarm() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
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
