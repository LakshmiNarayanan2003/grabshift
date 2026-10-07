import { TUNING, type PlayerId, type PlayerInput } from '../config';
import { Bodies, Body, Composite, Constraint, Query, Vector, clamp, info, servo, tag, worldPoint, type BodyType, type ConstraintType } from '../utils/physics';
import { Hand } from './Hand';

export class Ragdoll {
  readonly bodies: BodyType[] = [];
  readonly joints: ConstraintType[] = [];
  readonly torso: BodyType;
  readonly head: BodyType;
  readonly upperArms: BodyType[] = [];
  readonly upperLegs: BodyType[] = [];
  readonly lowerLegs: BodyType[] = [];
  readonly hands: [Hand, Hand];
  grounded = false;
  facing = 1;
  lastGrounded = -Infinity;
  lastJump = -Infinity;
  jumps = 0;
  private gait = 0;

  constructor(readonly id: PlayerId, x: number, y: number, world: Matter.World) {
    const group = Body.nextGroup(true);
    const make = (part: string, dx: number, dy: number, w: number, h: number, density = 0.0016) => {
      const body = Bodies.rectangle(x + dx, y + dy, w, h, { chamfer: { radius: Math.min(w / 2 - 1, 7) }, density, friction: 0.55, frictionStatic: 1, frictionAir: 0.018, restitution: 0.05, collisionFilter: { group } });
      tag(body, { kind: 'player', owner: id, part, grabbable: true });
      this.bodies.push(body); return body;
    };
    this.torso = make('torso', 0, 0, 32, 48, 0.0024);
    this.head = make('head', 0, -43, 32, 30, 0.0012);
    const join = (a: BodyType, b: BodyType, pa: Matter.Vector, pb: Matter.Vector) => {
      const joint = Constraint.create({ bodyA: a, bodyB: b, pointA: pa, pointB: pb, length: 2, stiffness: 0.85, damping: 0.16 });
      this.joints.push(joint);
    };
    join(this.torso, this.head, { x: 0, y: -24 }, { x: 0, y: 15 });
    const hands: Hand[] = [];
    for (const [i, side] of (['left', 'right'] as const).entries()) {
      const sign = i === 0 ? -1 : 1;
      const arm = make(`${side} upper arm`, sign * 25, -6, 13, 32);
      const forearm = make(`${side} forearm`, sign * 28, 27, 12, 34);
      this.upperArms.push(arm);
      join(this.torso, arm, { x: sign * 18, y: -19 }, { x: 0, y: -16 });
      join(arm, forearm, { x: 0, y: 16 }, { x: 0, y: -17 });
      hands.push(new Hand(side, forearm));
      const thigh = make(`${side} upper leg`, sign * 10, 43, 15, 36);
      const shin = make(`${side} lower leg`, sign * 10, 78, 14, 34);
      this.upperLegs.push(thigh); this.lowerLegs.push(shin);
      join(this.torso, thigh, { x: sign * 10, y: 24 }, { x: 0, y: -18 });
      join(thigh, shin, { x: 0, y: 18 }, { x: 0, y: -17 });
    }
    this.hands = hands as [Hand, Hand];
    this.facing = id === 0 ? 1 : -1;
    Composite.add(world, [...this.bodies, ...this.joints]);
  }

  update(input: PlayerInput, bodies: BodyType[], now: number): void {
    const surfaces = bodies.filter(b => info(b)?.owner !== this.id && info(b)?.kind !== 'player');
    this.grounded = this.lowerLegs.some(leg => {
      const foot = worldPoint(leg, { x: 0, y: 16 });
      return Query.ray(surfaces, { x: foot.x, y: foot.y - 3 }, { x: foot.x, y: foot.y + 9 }, 9).length > 0;
    });
    if (this.grounded && now - this.lastJump > TUNING.jumpCooldown) this.lastGrounded = now;
    const held = this.hands.some(h => h.grabbed);
    // Active balance acts like a spring through the feet. It unloads the knees
    // while grounded; in flight the whole character is a free ragdoll.
    if (this.grounded && now - this.lastJump > TUNING.jumpCooldown) {
      const support = surfaces.filter(b => ['platform', 'crate'].includes(info(b)?.kind ?? '') &&
        b.bounds.min.x - 8 < this.torso.position.x && b.bounds.max.x + 8 > this.torso.position.x &&
        b.bounds.min.y > this.torso.position.y + 20 && b.bounds.min.y < this.torso.position.y + 112)
        .sort((a, b) => a.bounds.min.y - b.bounds.min.y)[0];
      if (support) {
        const totalMass = this.bodies.reduce((sum, b) => sum + b.mass, 0);
        const error = support.bounds.min.y - 92 - this.torso.position.y;
        Body.applyForce(this.torso, this.torso.position, { x: 0, y: totalMass * clamp(error * 0.000055 - this.torso.velocity.y * 0.00035 - 0.00115, -0.0045, 0) });
      }
    }
    if (input.move) this.facing = Math.sign(input.move);
    this.gait += Math.abs(input.move) * 0.12;
    for (const body of this.bodies) {
      if (input.move && (body.velocity.x * input.move < TUNING.maxSpeed || held)) {
        Body.applyForce(body, body.position, { x: input.move * body.mass * TUNING.moveForce * (this.grounded || held ? 1 : TUNING.airControl), y: 0 });
      }
    }
    const groundJump = now - this.lastGrounded < TUNING.coyoteMs;
    if (input.jump && now - this.lastJump > TUNING.jumpCooldown && (groundJump || held)) {
      for (const body of this.bodies) Body.setVelocity(body, { x: body.velocity.x, y: groundJump ? Math.min(body.velocity.y, -TUNING.jumpSpeed) : Math.max(-12, body.velocity.y - 5.4) });
      this.lastJump = now; this.lastGrounded = -Infinity; this.jumps++;
    }
    const stability = this.grounded ? 1 : held ? 0.32 : 0.28;
    servo(this.torso, input.move * 0.12, TUNING.posture * stability);
    servo(this.head, this.torso.angle * 0.3, TUNING.posture * 0.4);
    for (let i = 0; i < 2; i++) {
      const walk = this.grounded ? Math.sin(this.gait + i * Math.PI) * 0.27 * Math.abs(input.move) : 0;
      servo(this.upperLegs[i], walk - input.move * 0.08, TUNING.posture * stability);
      servo(this.lowerLegs[i], -walk * 0.35, TUNING.posture * stability);
      const hand = this.hands[i];
      if (!hand.grabbed) {
        const rest = i === 0 ? 0.25 : -0.25;
        servo(this.upperArms[i], rest, TUNING.posture * 0.15);
        servo(hand.body, rest, TUNING.posture * 0.1);
      }
    }
    // Soft anatomical limits: restore an overextended joint using torque, never position snaps.
    for (const joint of this.joints) {
      const a = joint.bodyA!, b = joint.bodyB!;
      const delta = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle));
      const limit = info(b)?.part?.includes('arm') ? 2.65 : 1.2;
      if (Math.abs(delta) > limit) servo(b, a.angle + clamp(delta, -limit, limit), TUNING.posture * 0.65);
    }
    // Safety caps only affect catastrophic solver explosions, not normal throws.
    for (const body of this.bodies) {
      const speed = Vector.magnitude(body.velocity);
      if (speed > 32) Body.setVelocity(body, Vector.mult(body.velocity, 32 / speed));
    }
  }
}
