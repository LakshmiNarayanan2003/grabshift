import { Bodies, Body, Composite, Constraint, tag, type BodyType, type ConstraintType } from '../utils/physics';

export class PitArena {
  readonly bodies: BodyType[] = [];
  readonly cables: ConstraintType[] = [];
  constructor(world: Matter.World) {
    const add = (body: BodyType, kind: 'platform' | 'bar' | 'crate' | 'rope' | 'ball') => {
      tag(body, { kind, grabbable: true }); this.bodies.push(body); return body;
    };
    for (const x of [315, 965]) add(Bodies.rectangle(x, 588, 470, 80, { isStatic: true, friction: 0.8, chamfer: { radius: 5 } }), 'platform');
    add(Bodies.rectangle(640, 230, 440, 20, { isStatic: true, chamfer: { radius: 7 } }), 'bar');
    for (const x of [445, 835]) add(Bodies.rectangle(x, 520, 46, 46, { density: 0.0015, friction: 0.62, restitution: 0.15, chamfer: { radius: 5 } }), 'crate');
    let previous: BodyType | undefined;
    const ropeGroup = Body.nextGroup(true);
    for (let i = 0; i < 4; i++) {
      const link = add(Bodies.rectangle(640, 258 + i * 25, 9, 25, { density: 0.0008, frictionAir: 0.014, collisionFilter: { group: ropeGroup } }), 'rope');
      this.cables.push(Constraint.create({ bodyA: previous, pointA: previous ? { x: 0, y: 12 } : { x: 640, y: 242 }, bodyB: link, pointB: { x: 0, y: -12 }, stiffness: 0.92, damping: 0.05, length: 2, label: 'rope' }));
      previous = link;
    }
    const hanging = add(Bodies.rectangle(640, 382, 60, 60, { density: 0.0011, frictionAir: 0.006, chamfer: { radius: 7 } }), 'crate');
    this.cables.push(Constraint.create({ bodyA: previous, pointA: { x: 0, y: 12 }, bodyB: hanging, pointB: { x: 0, y: -30 }, stiffness: 0.9, damping: 0.05, length: 7, label: 'rope' }));
    const ball = add(Bodies.circle(999, 310, 29, { density: 0.0035, frictionAir: 0.0008, restitution: 0.35 }), 'ball');
    this.cables.push(Constraint.create({ pointA: { x: 1100, y: 145 }, bodyB: ball, length: 235, stiffness: 0.94, damping: 0, label: 'cable' }));
    Body.setVelocity(ball, { x: -2.8, y: 1 });
    Composite.add(world, [...this.bodies, ...this.cables]);
  }
}
