import { Engine, Composite, Bodies, tag } from '../utils/physics';
import { Ragdoll } from '../entities/Ragdoll';
import { WORLD, idleInput, type PlayerInput } from '../config';
import { GrabSystem } from './GrabSystem';
import { PitArena } from '../arenas/PitArena';
import type { GrabEvent } from './GrabSystem';

/** Fixed-step physics is independent of rendering, so the actual gameplay can be tested headlessly. */
export class Simulation {
  readonly engine = Engine.create({ positionIterations: 8, velocityIterations: 8, constraintIterations: 6, enableSleeping: false });
  players: Ragdoll[] = [];
  time = 0;
  readonly grabs: GrabSystem;
  arena: PitArena | null = null;
  constructor(private playerCount = 1, private arenaType: 'training' | 'pit' = 'training', emit?: (event: GrabEvent) => void) {
    this.engine.gravity.y = 1.15;
    this.grabs = new GrabSystem(this.engine.world, emit);
    this.reset();
  }
  reset(): void {
    this.grabs.releaseAll(this.players);
    Composite.clear(this.engine.world, false); Engine.clear(this.engine);
    this.players = []; this.time = 0;
    if (this.arenaType === 'pit') this.arena = new PitArena(this.engine.world);
    else Composite.add(this.engine.world, tag(Bodies.rectangle(640, 588, 1180, 80, { isStatic: true, friction: 0.8 }), { kind: 'platform', grabbable: true }));
    for (let i = 0; i < this.playerCount; i++) this.players.push(new Ragdoll(i as 0 | 1, i === 0 ? 310 : 970, 448, this.engine.world));
  }
  step(inputs: PlayerInput[] = [idleInput(), idleInput()]): void {
    this.time += WORLD.step;
    const bodies = Composite.allBodies(this.engine.world);
    this.players.forEach((p, i) => {
      const input = inputs[i] ?? idleInput();
      if (input.left) this.grabs.toggle(p, p.hands[0]);
      if (input.right) this.grabs.toggle(p, p.hands[1]);
      p.update(input, bodies, this.time);
      this.grabs.update(p);
    });
    Engine.update(this.engine, WORLD.step);
  }
  dispose(): void { Composite.clear(this.engine.world, false); Engine.clear(this.engine); }
}
