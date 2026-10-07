import test from 'node:test';
import assert from 'node:assert/strict';
import { RoundSystem } from '../src/game/systems/RoundSystem';
import { Simulation } from '../src/game/systems/Simulation';
import { Body } from '../src/game/utils/physics';

test('countdown gates gameplay, a fall scores once, first to three ends match, rematch clears state', () => {
  const rounds = new RoundSystem(), sim = new Simulation(2, 'pit');
  assert.equal(rounds.countdown, '3'); rounds.update(1000, sim.players); assert.equal(rounds.countdown, '2');
  rounds.update(1000, sim.players); assert.equal(rounds.countdown, '1');
  assert.equal(rounds.update(1000, sim.players), 'go'); assert.equal(rounds.countdown, 'GRAB!');
  for (let point = 1; point <= 3; point++) {
    Body.setPosition(sim.players[1].torso, { x: 640, y: 801 });
    assert.equal(rounds.update(16, sim.players), 'point'); assert.deepEqual(rounds.scores, [point, 0]);
    rounds.update(100, sim.players); assert.deepEqual(rounds.scores, [point, 0]);
    const result = rounds.update(1800, sim.players);
    if (point < 3) { assert.equal(result, 'reset'); sim.reset(); rounds.update(3000, sim.players); }
  }
  assert.equal(rounds.phase, 'matchOver'); assert.equal(rounds.winner, 0);
  rounds.restart(); sim.reset();
  assert.equal(rounds.round, 1); assert.deepEqual(rounds.scores, [0, 0]); assert.equal(rounds.phase, 'countdown');
  sim.dispose();
});

test('simultaneous fall is a draw and replays the round', () => {
  const rounds = new RoundSystem(), sim = new Simulation(2);
  rounds.update(3000, sim.players);
  for (const player of sim.players) Body.setPosition(player.torso, { x: 640, y: 810 });
  rounds.update(16, sim.players);
  assert.equal(rounds.draw, true); assert.deepEqual(rounds.scores, [0, 0]);
  assert.equal(rounds.update(1900, sim.players), 'reset'); assert.equal(rounds.round, 1);
  sim.dispose();
});
