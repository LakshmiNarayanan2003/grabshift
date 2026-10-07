import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/systems/Simulation';
import { Composite, info } from '../src/game/utils/physics';

test('The Pit has all hazards, stable spawns, and bounded reset object counts', () => {
  const sim = new Simulation(2, 'pit');
  const count = () => [Composite.allBodies(sim.engine.world).length, Composite.allConstraints(sim.engine.world).length];
  const initial = count();
  const bodies = Composite.allBodies(sim.engine.world);
  assert.equal(bodies.filter(b => info(b)?.kind === 'crate').length, 3);
  assert.equal(bodies.filter(b => info(b)?.kind === 'ball').length, 1);
  assert.equal(bodies.filter(b => info(b)?.kind === 'rope').length, 4);
  for (let i = 0; i < 300; i++) sim.step();
  for (const p of sim.players) assert.ok(p.torso.position.y < 500, 'spawn remains upright');
  for (let i = 0; i < 100; i++) {
    sim.reset(); assert.deepEqual(count(), initial);
    const ropes = sim.arena!.bodies.filter(b => info(b)?.kind === 'rope');
    for (const p of sim.players) assert.notEqual(p.torso.collisionFilter.group, ropes[0].collisionFilter.group, 'rope and player collision groups stay distinct across many rounds');
  }
  sim.dispose();
});
