import type { AudioRuntime, SpeleumSfx } from "@/lib/audio/audio";

const effectProfiles: Record<
  SpeleumSfx,
  { start: number; end: number; duration: number; type: OscillatorType }
> = {
  ui: { start: 420, end: 520, duration: 0.08, type: "sine" },
  ready: { start: 520, end: 760, duration: 0.16, type: "sine" },
  start: { start: 180, end: 620, duration: 0.36, type: "triangle" },
  attack: { start: 170, end: 70, duration: 0.13, type: "sawtooth" },
  damage: { start: 95, end: 45, duration: 0.22, type: "square" },
  defend: { start: 640, end: 980, duration: 0.18, type: "sine" },
  death: { start: 180, end: 35, duration: 0.65, type: "sawtooth" },
  victory: { start: 440, end: 880, duration: 0.7, type: "triangle" },
  defeat: { start: 260, end: 65, duration: 0.7, type: "triangle" },
};

export class WebAudioRuntime implements AudioRuntime {
  private context: AudioContext | null = null;
  private ambientOscillator: OscillatorNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientRequested = false;
  private ambientVolume = 0;
  private disposed = false;

  private getContext() {
    if (this.disposed || typeof window === "undefined") return null;
    if (!this.context) {
      const AudioContextClass = window.AudioContext;
      this.context = new AudioContextClass();
    }
    return this.context;
  }

  async unlock() {
    const context = this.getContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume();
    if (this.ambientRequested) this.startAmbient();
  }

  setAmbient(active: boolean, volume: number) {
    this.ambientRequested = active;
    this.ambientVolume = Math.max(0, Math.min(1, volume));
    if (!active || this.ambientVolume <= 0) {
      this.stopAmbient();
      return;
    }
    if (this.context?.state === "running") this.startAmbient();
    if (this.ambientGain && this.context) {
      this.ambientGain.gain.setTargetAtTime(
        this.ambientVolume * 0.075,
        this.context.currentTime,
        0.25,
      );
    }
  }

  private startAmbient() {
    const context = this.getContext();
    if (!context || this.ambientOscillator) return;

    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, this.ambientVolume * 0.075),
      context.currentTime + 1.2,
    );
    gain.connect(context.destination);

    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = 48;
    oscillator.connect(gain);

    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.12;
    lfoGain.gain.value = 7;
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);

    oscillator.start();
    lfo.start();
    this.ambientOscillator = oscillator;
    this.ambientLfo = lfo;
    this.ambientGain = gain;
  }

  private stopAmbient() {
    this.ambientOscillator?.stop();
    this.ambientLfo?.stop();
    this.ambientOscillator?.disconnect();
    this.ambientLfo?.disconnect();
    this.ambientGain?.disconnect();
    this.ambientOscillator = null;
    this.ambientLfo = null;
    this.ambientGain = null;
  }

  playEffect(effect: SpeleumSfx, volume: number) {
    const context = this.getContext();
    if (!context || volume <= 0) return;
    void this.unlock();

    const profile = effectProfiles[effect];
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(profile.end, now + profile.duration);
    gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.16), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + profile.duration);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      gain.disconnect();
    });
  }

  dispose() {
    if (this.disposed) return;
    this.stopAmbient();
    this.disposed = true;
    if (this.context && this.context.state !== "closed") void this.context.close();
    this.context = null;
  }
}
