import { TUNING } from '../config';
import type { Ragdoll } from '../entities/Ragdoll';
import type { Hand } from '../entities/Hand';
import { Body, Composite, Constraint, Vector, closestPoint, info, clamp, servo, type BodyType } from '../utils/physics';

export interface GrabEvent { type: 'grab' | 'release'; x: number; y: number; player: number; speed: number }
export class GrabSystem {
  constructor(private world: Matter.World, private emit: (event: GrabEvent) => void = () => {}) {}
  toggle(player: Ragdoll, hand: Hand): void {
    if (hand.armed || hand.grabbed) this.release(player, hand);
    else { hand.armed = true; this.tryGrab(player, hand); }
  }
  private candidates(player: Ragdoll, hand: Hand, radius: number) {
    const point = hand.point;
    return Composite.allBodies(this.world)
      .filter(b => info(b)?.grabbable && info(b)?.owner !== player.id && b.position.y < 780)
      .map(body => { const anchor = closestPoint(body, point); return { body, anchor, distance: Vector.magnitude(Vector.sub(anchor, point)) }; })
      .filter(c => c.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }
  tryGrab(player: Ragdoll, hand: Hand): boolean {
    if (!hand.armed || hand.grabbed) return false;
    const candidate = this.candidates(player, hand, TUNING.grabRadius)[0];
    if (!candidate) return false;
    const constraint = Constraint.create({
      bodyA: hand.body, pointA: Vector.sub(hand.point, hand.body.position),
      bodyB: candidate.body, pointB: Vector.sub(candidate.anchor, candidate.body.position),
      length: Math.max(3, candidate.distance * 0.45), stiffness: TUNING.grabStiffness, damping: TUNING.grabDamping,
      label: 'grip',
    });
    hand.constraint = constraint; hand.target = candidate.body;
    Composite.add(this.world, constraint);
    this.emit({ type: 'grab', ...hand.point, player: player.id, speed: hand.body.speed });
    return true;
  }
  update(player: Ragdoll): void {
    player.hands.forEach((hand, i) => {
      if (hand.grabbed) {
        if (!hand.target || !Composite.get(this.world, hand.target.id, 'body')) this.release(player, hand);
        return;
      }
      if (!hand.armed) return;
      if (this.tryGrab(player, hand)) return;
      const candidate = this.candidates(player, hand, TUNING.reachRadius)[0];
      const target = candidate?.anchor ?? { x: player.torso.position.x + player.facing * 68, y: player.torso.position.y - 35 - i * 12 };
      const difference = Vector.sub(target, hand.point);
      Body.applyForce(hand.body, hand.point, {
        x: clamp(difference.x * 0.000045, -0.0035, 0.0035) * hand.body.mass,
        y: clamp(difference.y * 0.000045 - 0.00115, -0.0035, 0.0035) * hand.body.mass,
      });
      const shoulder = player.upperArms[i].position;
      servo(player.upperArms[i], Math.atan2(shoulder.x - target.x, target.y - shoulder.y), 0.000055);
    });
  }
  release(player: Ragdoll, hand: Hand): void {
    if (hand.constraint) {
      this.emit({ type: 'release', ...hand.point, player: player.id, speed: Math.max(hand.body.speed, hand.target?.speed ?? 0) });
      Composite.remove(this.world, hand.constraint);
    }
    // Removing a constraint leaves both bodies' linear and angular momentum intact.
    hand.constraint = null; hand.target = null; hand.armed = false;
  }
  releaseAll(players: Ragdoll[]): void { for (const p of players) for (const h of p.hands) this.release(p, h); }
  get targets(): BodyType[] { return Composite.allBodies(this.world).filter(b => info(b)?.grabbable); }
}
