// نظام تنبيهات صوتية تركيبي باستخدام Web Audio API يعمل فوراً دون الحاجة لملفات صوت خارجية
class SoundNotifier {
  private audioCtx: AudioContext | null = null;
  private intervalId: any = null;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // عزف نغمة الجرس المزدوج المميزة للطلبات
  private playChime() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // النغمة الأولى (عالية)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.3, now);
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
      gain2.gain.setValueAtTime(0.4, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn("Sound play error:", e);
    }
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
