import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/systems/Simulation';
import { Composite } from '../src/game/utils/physics';

test('seeded ten-thousand-step gameplay stress run keeps finite physics and bounded objects', () => {
  const sim = new Simulation(2, 'pit');
  const initialBodies = Composite.allBodies(sim.engine.world).length;
  const initialConstraints = Composite.allConstraints(sim.engine.world).length;
  let seed = 45191, resets = 0;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let frame = 0; frame < 10000; frame++) {
    sim.step(sim.players.map(p => ({ move: frame % 360 < 180 ? p.id === 0 ? 1 : -1 : p.id === 0 ? -1 : 1, jump: random() < 0.035, left: random() < 0.02, right: random() < 0.02 })));
    for (const body of Composite.allBodies(sim.engine.world)) {
      for (const value of [body.position.x, body.position.y, body.velocity.x, body.velocity.y, body.angle]) assert.ok(Number.isFinite(value));
    }
    assert.equal(Composite.allBodies(sim.engine.world).length, initialBodies);
    assert.ok(Composite.allConstraints(sim.engine.world).length <= initialConstraints + 4);
    if (sim.players.some(p => p.torso.position.y > 780) || frame % 600 === 599) { sim.reset(); resets++; }
  }
  assert.ok(resets >= 16);
  sim.dispose();
  assert.equal(Composite.allBodies(sim.engine.world).length, 0);
  assert.equal(Composite.allConstraints(sim.engine.world).length, 0);
});
