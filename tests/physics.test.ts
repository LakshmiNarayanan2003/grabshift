import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/systems/Simulation';
import { idleInput } from '../src/game/config';

test('ragdoll stands, moves with forces, and cannot jump repeatedly in midair', () => {
  const sim = new Simulation(1);
  for (let i = 0; i < 180; i++) sim.step();
  const p = sim.players[0];
  assert.equal(p.bodies.length, 10);
  assert.ok(p.torso.position.y < 485, `standing torso y=${p.torso.position.y}`);
  const x = p.torso.position.x;
  for (let i = 0; i < 45; i++) sim.step([{ ...idleInput(), move: 1 }]);
  assert.ok(p.torso.position.x > x + 40, 'walk right');
  const y = p.torso.position.y;
  sim.step([{ ...idleInput(), jump: true }]);
  for (let i = 0; i < 12; i++) sim.step([{ ...idleInput(), jump: true }]);
  assert.ok(p.torso.position.y < y - 30, 'jump gains height');
  assert.equal(p.jumps, 1);
  sim.dispose();
});

test('two players have independent movement and grounded jumping', () => {
  const sim = new Simulation(2);
  for (let i = 0; i < 90; i++) sim.step();
  const starts = sim.players.map(p => p.torso.position.x);
  for (let i = 0; i < 45; i++) sim.step([{ ...idleInput(), move: 1 }, { ...idleInput(), move: -1 }]);
  assert.ok(sim.players[0].torso.position.x > starts[0] + 40);
  assert.ok(sim.players[1].torso.position.x < starts[1] - 40);
  sim.step([{ ...idleInput(), jump: true }, { ...idleInput(), jump: true }]);
  assert.deepEqual(sim.players.map(p => p.jumps), [1, 1]);
  sim.dispose();
});
