import { WORLD, type PlayerId } from '../config';
import type { Ragdoll } from '../entities/Ragdoll';

export type RoundPhase = 'countdown' | 'active' | 'resolving' | 'matchOver';
export class RoundSystem {
  scores: [number, number] = [0, 0];
  round = 1;
  phase: RoundPhase = 'countdown';
  remaining = 3000;
  winner: PlayerId | null = null;
  draw = false;
  activeFor = 0;
  get countdown(): string { return this.phase === 'countdown' ? String(Math.max(1, Math.ceil(this.remaining / 1000))) : this.phase === 'active' && this.activeFor < 650 ? 'GRAB!' : ''; }
  update(delta: number, players: Ragdoll[]): 'reset' | 'point' | 'go' | null {
    if (this.phase === 'matchOver') return null;
    if (this.phase === 'active') {
      this.activeFor += delta;
      const fallen = players.map(p => p.torso.position.y > WORLD.deathY || p.torso.position.x < -160 || p.torso.position.x > WORLD.width + 160);
      if (!fallen.some(Boolean)) return null;
      this.draw = fallen.every(Boolean);
      this.winner = this.draw ? null : fallen[0] ? 1 : 0;
      if (this.winner !== null) this.scores[this.winner]++;
      this.phase = 'resolving'; this.remaining = 1800;
      return 'point';
    }
    this.remaining -= delta;
    if (this.remaining > 0) return null;
    if (this.phase === 'countdown') { this.phase = 'active'; this.activeFor = 0; return 'go'; }
    if (this.scores.some(score => score >= 3)) { this.phase = 'matchOver'; return null; }
    if (!this.draw) this.round++;
    this.phase = 'countdown'; this.remaining = 3000; this.winner = null; this.draw = false;
    return 'reset';
  }
  restart(): void { this.scores = [0, 0]; this.round = 1; this.phase = 'countdown'; this.remaining = 3000; this.winner = null; this.draw = false; this.activeFor = 0; }
}
