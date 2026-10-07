import test from 'node:test';
import assert from 'node:assert/strict';
import { BotSystem } from '../src/game/systems/BotSystem';
import { Simulation } from '../src/game/systems/Simulation';
import { idleInput, WORLD } from '../src/game/config';
import { DIFFICULTIES } from '../src/game/match';
import { Body, Composite } from '../src/game/utils/physics';

function settle(sim: Simulation) { for (let i = 0; i < 180; i++) sim.step(); }
function movePlayer(sim: Simulation, id: number, x: number, y?: number) {
  const p = sim.players[id];
  const shift = { x: x - p.torso.position.x, y: y === undefined ? 0 : y - p.torso.position.y };
  for (const body of p.bodies) Body.translate(body, shift);
}

test('bot decisions only return legal inputs and never change bodies, constraints, or velocities', () => {
  const sim = new Simulation(2, 'pit'); settle(sim);
  const snapshot = () => JSON.stringify({ bodies: Composite.allBodies(sim.engine.world).map(b => [b.id, b.position, b.velocity, b.angle, b.force, b.torque]), constraints: Composite.allConstraints(sim.engine.world).map(c => c.id), time: sim.time });
  for (const difficulty of DIFFICULTIES) {
    const bot = new BotSystem(difficulty, 42), before = snapshot();
    const input = bot.read(sim);
    assert.ok([-1, 0, 1].includes(input.move));
    assert.equal(typeof input.jump, 'boolean'); assert.equal(typeof input.left, 'boolean'); assert.equal(typeof input.right, 'boolean');
    assert.equal(snapshot(), before);
    const betweenDecisions = bot.read(sim);
    assert.equal(betweenDecisions.left, false); assert.equal(betweenDecisions.right, false); assert.equal(betweenDecisions.jump, false);
  }
  sim.dispose();
});

test('combat reaction cadence distinguishes easy, medium, and hard without altering physical stats', () => {
  const sim = new Simulation(2); settle(sim);
  const x = sim.players[1].torso.position.x;
  movePlayer(sim, 0, x - 170);
  const bots = DIFFICULTIES.map(d => new BotSystem(d, 42));
  for (const bot of bots) assert.equal(bot.read(sim).move, -1);
  movePlayer(sim, 0, x + 170);
  sim.time += 100;
  assert.deepEqual(bots.map(b => b.read(sim).move), [-1, -1, 1]);
  sim.time += 100;
  assert.deepEqual(bots.map(b => b.read(sim).move), [-1, 1, 1]);
  sim.time += 100;
  assert.deepEqual(bots.map(b => b.read(sim).move), [1, 1, 1]);
  assert.equal(sim.players[0].torso.mass, sim.players[1].torso.mass);
  sim.dispose();
});

for (const difficulty of DIFFICULTIES) {
  test(`${difficulty}: crosses the real arena and engages before falling`, () => {
    const sim = new Simulation(2, 'pit'), bot = new BotSystem(difficulty, 42); settle(sim);
    let opponentGrip = false, environmentalGrip = false, released = false;
    const counts = [Composite.allBodies(sim.engine.world).length, Composite.allConstraints(sim.engine.world).length];
    for (let i = 0; i < 600; i++) {
      const input = bot.read(sim);
      const hadGrip = sim.players[1].hands.some(h => h.grabbed);
      if (hadGrip && (input.left || input.right)) released = true;
      sim.step([idleInput(), input]);
      const ai = sim.players[1];
      opponentGrip ||= ai.hands.some(h => h.target?.plugin.grabshift.owner === 0);
      environmentalGrip ||= ai.hands.some(h => h.target && h.target.plugin.grabshift.kind !== 'player');
      assert.equal(Composite.allBodies(sim.engine.world).length, counts[0]);
      assert.ok(Composite.allConstraints(sim.engine.world).length <= counts[1] + 2);
      assert.ok(ai.torso.position.y <= WORLD.deathY, 'bot must survive the approach');
      // A bot may legitimately lose once combat starts. Full ragdoll fights
      // diverge across JS engines, even with identical inputs and RNG seeds.
      if (opponentGrip) break;
    }
    const opponentPlatform = sim.arena!.bodies.find(b => b.plugin.grabshift.kind === 'platform')!;
    assert.ok(sim.players[1].torso.position.x < opponentPlatform.bounds.max.x, 'crosses the central gap');
    assert.ok(sim.players[1].jumps > 0, 'jumps');
    assert.ok(opponentGrip, 'grips opponent'); assert.ok(environmentalGrip, 'uses arena grips'); assert.ok(released, 'releases grips');
    sim.reset(); bot.reset();
    assert.equal(bot.read(sim).move, -1, 'reset clears old navigation and action deadlines');
    assert.deepEqual([Composite.allBodies(sim.engine.world).length, Composite.allConstraints(sim.engine.world).length], counts);
    sim.dispose();
  });

  test(`${difficulty}: releases an outward-moving opponent at the pit edge and the throw can score`, () => {
    const sim = new Simulation(2, 'pit'), bot = new BotSystem(difficulty, 42); settle(sim);
    // Isolate the throw decision from a chaotic fight's particular trajectory.
    movePlayer(sim, 0, 530, 450); movePlayer(sim, 1, 475, 450);
    const [opponent, ai] = sim.players, hand = ai.hands[0];
    Body.translate(hand.body, { x: opponent.torso.position.x - hand.point.x, y: opponent.torso.position.y - hand.point.y });
    sim.grabs.toggle(ai, hand);
    assert.equal(hand.target, opponent.torso, 'fixture uses a real opponent grip');
    bot.read(sim); // Observe the newly acquired grip.
    sim.time += bot.profile.holdMs + 200;
    for (const body of opponent.bodies) Body.setVelocity(body, { x: 5, y: 0 });
    const input = bot.read(sim);
    assert.equal(input.move, 1, 'drags toward the nearby pit edge');
    assert.equal(input.left, true, 'releases the outward-moving opponent');
    const velocity = { ...opponent.torso.velocity };
    sim.grabs.toggle(ai, hand);
    assert.equal(hand.grabbed, false);
    assert.deepEqual(opponent.torso.velocity, velocity, 'release preserves throw momentum');
    for (let i = 0; i < 180 && opponent.torso.position.y <= WORLD.deathY; i++) sim.step();
    assert.ok(opponent.torso.position.y > WORLD.deathY, 'released opponent crosses the round loss boundary');
    sim.dispose();
  });
}

test('equal seeds produce reproducible bot actions and trajectories through a full approach', () => {
  const traces: string[] = [];
  for (let repeat = 0; repeat < 2; repeat++) {
    const sim = new Simulation(2, 'pit'), bot = new BotSystem('easy', 913); settle(sim);
    const samples = [];
    for (let i = 0; i < 350; i++) {
      const input = bot.read(sim); sim.step([idleInput(), input]);
      const p = sim.players[1].torso.position;
      samples.push([input, p.x.toFixed(5), p.y.toFixed(5)]);
    }
    traces.push(JSON.stringify(samples)); sim.dispose();
  }
  assert.equal(traces[0], traces[1]);
});

test('bot-vs-active-opponent stress: all difficulties remain finite over repeated rounds', () => {
  for (const difficulty of DIFFICULTIES) {
    const sim = new Simulation(2, 'pit'), bot = new BotSystem(difficulty, 17), sparring = new BotSystem('medium', 51, 0);
    let rounds = 0;
    for (let i = 0; i < 6000; i++) {
      sim.step([sparring.read(sim), bot.read(sim)]);
      for (const body of Composite.allBodies(sim.engine.world)) {
        assert.ok(Number.isFinite(body.position.x) && Number.isFinite(body.position.y) && Number.isFinite(body.angle));
      }
      assert.ok(Composite.allConstraints(sim.engine.world).length <= 28);
      if (sim.players.some(p => p.torso.position.y > WORLD.deathY) || i % 1200 === 1199) {
        sim.reset(); bot.reset(); sparring.reset(); rounds++;
      }
    }
    assert.ok(rounds >= 5); sim.dispose();
  }
});
