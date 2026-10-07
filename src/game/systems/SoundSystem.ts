import type { Settings } from './Settings';

/** Original procedural sound cues; no recordings, network requests, or copyrighted assets. */
export class SoundSystem {
  private context: AudioContext | null = null;
  constructor(readonly settings: Settings) {}
  unlock(): void {
    if (!this.settings.sound) return;
    try { this.context ??= new AudioContext(); void this.context.resume().catch(() => {}); } catch { /* Audio is optional when a browser blocks it. */ }
  }
  play(kind: 'grab' | 'release' | 'impact' | 'go' | 'point' | 'tick', strength = 1): void {
    if (!this.context || !this.settings.sound || this.context.state !== 'running') return;
    const ctx = this.context, start = ctx.currentTime;
    const frequencies = { grab: 460, release: 240, impact: 95, go: 660, point: 330, tick: 390 };
    const duration = kind === 'point' ? 0.42 : kind === 'go' ? 0.2 : 0.085;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = kind === 'impact' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequencies[kind], start);
    oscillator.frequency.exponentialRampToValueAtTime(frequencies[kind] * (kind === 'go' || kind === 'grab' ? 1.7 : 0.4), start + duration);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(this.settings.volume * Math.min(strength, 1) * 0.15, start + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + duration + 0.015);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  dispose(): void { if (this.context) void this.context.close().catch(() => {}); this.context = null; }
}
