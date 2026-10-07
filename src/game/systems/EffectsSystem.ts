import Phaser from 'phaser';
import { COLORS } from '../config';
import type { Settings } from './Settings';
import type { SoundSystem } from './SoundSystem';
import type { GrabEvent } from './GrabSystem';
import { clamp } from '../utils/physics';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: number; size: number }
export class EffectsSystem {
  private particles: Particle[] = [];
  private flashes = new Map<number, number>();
  private lastImpact = -Infinity;
  private lastThrow = -Infinity;
  slowFor = 0;
  constructor(private scene: Phaser.Scene, private settings: Settings, private sound: SoundSystem) {}
  burst(x: number, y: number, color: number, amount: number, force = 1): void {
    const count = this.settings.reducedMotion ? Math.min(amount, 3) : amount;
    for (let i = 0; i < count && this.particles.length < 120; i++) {
      const angle = Math.random() * Math.PI * 2, speed = (0.6 + Math.random() * 2.2) * force;
      const life = 220 + Math.random() * 240;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life, color, size: 1 + Math.random() * 2 });
    }
  }
  grab(event: GrabEvent): void {
    this.burst(event.x, event.y, event.type === 'grab' ? COLORS.lime : COLORS.white, event.type === 'grab' ? 8 : 5);
    this.sound.play(event.type);
    if (event.type === 'release' && event.speed > 9 && this.scene.time.now - this.lastThrow > 1000) {
      this.lastThrow = this.scene.time.now; this.slowFor = this.settings.reducedMotion ? 0 : 95;
    }
  }
  impact(x: number, y: number, intensity: number, ids: number[]): void {
    if (intensity < 5 || this.scene.time.now - this.lastImpact < 85) return;
    this.lastImpact = this.scene.time.now;
    const strength = clamp((intensity - 4) / 11, 0, 1);
    this.burst(x, y, COLORS.white, Math.ceil(4 + strength * 12), 1 + strength);
    ids.forEach(id => this.flashes.set(id, 85));
    this.sound.play('impact', strength);
    if (!this.settings.reducedMotion && intensity > 8) this.scene.cameras.main.shake(90, 0.001 + strength * 0.0015);
  }
  isFlashing(id: number) { return this.flashes.has(id); }
  update(delta: number): void {
    this.slowFor = Math.max(0, this.slowFor - delta);
    this.flashes.forEach((life, id) => { if (life <= delta) this.flashes.delete(id); else this.flashes.set(id, life - delta); });
    for (const p of this.particles) { p.life -= delta; p.x += p.vx * delta / 16.67; p.y += p.vy * delta / 16.67; p.vy += delta * 0.003; }
    this.particles = this.particles.filter(p => p.life > 0);
  }
  draw(g: Phaser.GameObjects.Graphics): void {
    for (const p of this.particles) { g.fillStyle(p.color, p.life / p.max); g.fillCircle(p.x, p.y, p.size); }
  }
  clear(): void { this.particles = []; this.flashes.clear(); this.slowFor = 0; }
}
