import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/game/systems/Simulation';
import { Bodies, Body, Composite, tag, Vector } from '../src/game/utils/physics';
import { idleInput } from '../src/game/config';

test('hands independently grip and release nearby objects; release preserves momentum', () => {
  const sim = new Simulation(1), p = sim.players[0];
  const [left, right] = p.hands;
  const crate = tag(Bodies.rectangle(left.point.x - 5, left.point.y + 5, 25, 25), { kind: 'crate', grabbable: true });
  const other = tag(Bodies.rectangle(right.point.x + 5, right.point.y + 5, 25, 25), { kind: 'crate', grabbable: true });
  Composite.add(sim.engine.world, [crate, other]);
  const count = Composite.allConstraints(sim.engine.world).length;
  sim.grabs.toggle(p, left); sim.grabs.toggle(p, right);
  assert.equal(left.target, crate); assert.equal(right.target, other);
  assert.equal(Composite.allConstraints(sim.engine.world).length, count + 2);
  Body.setVelocity(crate, { x: 11, y: -6 }); Body.setAngularVelocity(crate, 0.12);
  sim.grabs.toggle(p, left);
  assert.equal(left.grabbed, false); assert.equal(right.grabbed, true);
  assert.deepEqual(crate.velocity, { x: 11, y: -6 }); assert.equal(crate.angularVelocity, 0.12);
  sim.grabs.toggle(p, right);
  assert.equal(Composite.allConstraints(sim.engine.world).length, count);
  sim.dispose();
});

test('natural approach grips a complete opponent and transfers momentum before release', () => {
  const sim = new Simulation(2);
  for (let i = 0; i < 120; i++) sim.step();
  const [a, b] = sim.players;
  const dx = a.torso.position.x + 80 - b.torso.position.x;
  for (const body of b.bodies) Body.translate(body, { x: dx, y: 0 });
  for (let i = 0; i < 55; i++) sim.step([{ ...idleInput(), move: 1, left: i === 0, right: i === 1, jump: i === 40 }, idleInput()]);
  for (const hand of a.hands) assert.equal(hand.target?.plugin.grabshift.owner, b.id);
  assert.ok(b.torso.velocity.x > 1, 'grabbing and moving transfers horizontal momentum');
  assert.ok(b.torso.position.y < 453, 'grounded jump can lift a held opponent');
  const velocity = { ...b.torso.velocity }, x = b.torso.position.x;
  sim.grabs.releaseAll(sim.players);
  assert.deepEqual(b.torso.velocity, velocity);
  for (let i = 0; i < 25; i++) sim.step();
  assert.ok(b.torso.position.x > x + 20, 'opponent keeps travelling after release');
  sim.dispose();
});

test('all designated arena body types are grabbable, including rope links and platform sides', () => {
  for (const kind of ['bar', 'rope', 'crate', 'ball', 'platform']) {
    const sim = new Simulation(1, 'pit'), p = sim.players[0];
    const target = sim.arena!.bodies.find(b => b.plugin.grabshift.kind === kind)!;
    const point = kind === 'platform' ? { x: target.bounds.min.x, y: target.position.y } : target.position;
    const shift = Vector.sub(point, p.hands[0].point);
    for (const body of p.bodies) Body.translate(body, shift);
    sim.grabs.toggle(p, p.hands[0]);
    assert.equal(p.hands[0].target, target, `${kind} grip`);
    sim.dispose();
  }
});

test('closest valid body wins, and an armed hand can be cancelled before latching', () => {
  const sim = new Simulation(), p = sim.players[0], hand = p.hands[0];
  sim.grabs.toggle(p, hand); assert.equal(hand.armed, true); assert.equal(hand.grabbed, false);
  sim.grabs.toggle(p, hand); assert.equal(hand.armed, false);
  const far = tag(Bodies.circle(hand.point.x - 24, hand.point.y, 5), { kind: 'crate', grabbable: true });
  const near = tag(Bodies.circle(hand.point.x - 12, hand.point.y, 5), { kind: 'crate', grabbable: true });
  Composite.add(sim.engine.world, [far, near]);
  sim.grabs.toggle(p, hand); assert.equal(hand.target, near);
  sim.dispose();
});

test('own ragdoll is excluded and the closest opponent part can be grabbed', () => {
  const sim = new Simulation(2), [a, b] = sim.players;
  sim.grabs.toggle(a, a.hands[0]);
  assert.equal(a.hands[0].grabbed, false);
  Body.setPosition(b.head, { ...a.hands[0].point });
  sim.grabs.update(a);
  assert.equal(a.hands[0].target, b.head);
  sim.grabs.releaseAll(sim.players); sim.dispose();
});

test('static overhead grip supports swinging; releasing keeps tangential motion', () => {
  const sim = new Simulation(), p = sim.players[0], hand = p.hands[1];
  const anchor = tag(Bodies.rectangle(hand.point.x, hand.point.y, 28, 15, { isStatic: true }), { kind: 'bar', grabbable: true });
  Composite.add(sim.engine.world, anchor); sim.grabs.toggle(p, hand);
  assert.equal(hand.target, anchor);
  for (const body of p.bodies) Body.setVelocity(body, { x: 5, y: -4 });
  for (let i = 0; i < 15; i++) sim.step([{ move: 1, jump: false, left: false, right: false }]);
  const velocity = { ...p.torso.velocity };
  assert.ok(Vector.magnitude(velocity) > 0.5);
  sim.grabs.release(p, hand);
  assert.deepEqual(p.torso.velocity, velocity);
  sim.dispose();
});
