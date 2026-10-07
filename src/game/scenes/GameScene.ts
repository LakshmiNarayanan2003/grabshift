import Phaser from 'phaser';
import { WORLD } from '../config';
import { Simulation } from '../systems/Simulation';
import { InputSystem } from '../systems/InputSystem';
import { Events, Vector, info } from '../utils/physics';
import { RoundSystem } from '../systems/RoundSystem';
import { EffectsSystem } from '../systems/EffectsSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { loadSettings } from '../systems/Settings';
import { ArenaRenderer } from '../rendering/ArenaRenderer';
import { UI } from '../../ui/UI';

export class GameScene extends Phaser.Scene {
  simulation!: Simulation;
  controls!: InputSystem;
  rounds = new RoundSystem();
  ui!: UI;
  paused = true;
  mode: 'menu' | 'match' = 'menu';
  debug = false;
  private arenaView!: ArenaRenderer;
  private effects!: EffectsSystem;
  private audioCues!: SoundSystem;
  private accumulator = 0;
  private lastCountdown = '';
  private readonly blur = () => { if (this.mode === 'match' && !this.paused && this.rounds.phase !== 'matchOver') this.pauseMatch(); };
  private readonly visibility = () => { if (document.hidden) this.blur(); };
  constructor() { super('Game'); }
  create(): void {
    const settings = loadSettings();
    this.audioCues = new SoundSystem(settings);
    this.effects = new EffectsSystem(this, settings, this.audioCues);
    this.simulation = new Simulation(2, 'pit', event => { if (this.mode === 'match' && this.rounds.phase === 'active') this.effects.grab(event); });
    this.controls = new InputSystem();
    this.arenaView = new ArenaRenderer(this);
    this.ui = new UI({ start: () => this.startMatch(), restart: () => this.startMatch(), resume: () => this.resumeMatch(), menu: () => this.mainMenu(), unlock: () => this.audioCues.unlock() }, settings);
    Events.on(this.simulation.engine, 'collisionStart', event => {
      if (this.mode !== 'match' || this.rounds.phase !== 'active') return;
      for (const pair of event.pairs) {
        const a = pair.bodyA, b = pair.bodyB;
        if (info(a)?.kind !== 'player' && info(b)?.kind !== 'player') continue;
        const velocity = Vector.sub(a.velocity, b.velocity);
        const intensity = Math.abs(Vector.dot(velocity, pair.collision.normal));
        const point = pair.collision.supports.find(Boolean) ?? a.position;
        this.effects.impact(point.x, point.y, intensity, [a.id, b.id]);
      }
    });
    window.addEventListener('blur', this.blur); document.addEventListener('visibilitychange', this.visibility);
    this.events.once('shutdown', () => {
      window.removeEventListener('blur', this.blur); document.removeEventListener('visibilitychange', this.visibility);
      Events.off(this.simulation.engine, 'collisionStart'); this.controls.dispose(); this.simulation.dispose(); this.audioCues.dispose(); this.ui.dispose();
    });
  }
  startMatch(): void {
    this.mode = 'match'; this.paused = false; this.rounds.restart(); this.simulation.reset(); this.controls.clear(); this.effects.clear(); this.accumulator = 0; this.lastCountdown = '';
  }
  pauseMatch(): void { this.paused = true; this.controls.clear(); this.accumulator = 0; this.ui.showPause(); }
  resumeMatch(): void { this.paused = false; this.controls.clear(); this.accumulator = 0; }
  mainMenu(): void { this.mode = 'menu'; this.paused = true; this.controls.clear(); this.effects.clear(); }
  update(_time: number, rawDelta: number): void {
    const delta = Math.min(rawDelta, 80);
    if (this.controls.take('Escape')) {
      if (this.ui.screen === 'game' && this.rounds.phase !== 'matchOver') this.pauseMatch();
      else if (this.ui.screen === 'pause') { this.resumeMatch(); this.ui.showGame(); }
      else this.ui.escape();
    }
    if (import.meta.env.DEV && this.controls.take('F3')) this.debug = !this.debug;
    if (this.mode === 'match' && !this.paused && this.rounds.phase !== 'matchOver') {
      const event = this.rounds.update(delta, this.simulation.players);
      if (event === 'reset') { this.simulation.reset(); this.controls.clear(); this.effects.clear(); this.accumulator = 0; }
      if (event === 'point') { this.controls.clear(); this.audioCues.play('point'); }
      if (event === 'go') { this.controls.clear(); this.audioCues.play('go'); }
      if (this.rounds.countdown !== this.lastCountdown) {
        if (this.rounds.phase === 'countdown') this.audioCues.play('tick');
        this.lastCountdown = this.rounds.countdown;
      }
      const speed = this.rounds.phase === 'resolving' ? 0.24 : this.effects.slowFor > 0 ? 0.4 : 1;
      this.accumulator += delta * speed;
      while (this.accumulator >= WORLD.step) {
        this.simulation.step(this.rounds.phase === 'active' ? this.controls.read() : this.controls.idle());
        this.accumulator -= WORLD.step;
      }
      if (this.rounds.phase !== 'active') this.controls.read();
      this.effects.update(delta);
      this.ui.update(this.rounds);
    }
    this.arenaView.draw(this.simulation, this.effects, this.debug, this.time.now);
  }
}
