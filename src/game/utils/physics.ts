import Matter from 'matter-js';
export const { Bodies, Body, Composite, Constraint, Engine, Events, Vector, Query } = Matter;
export type BodyType = Matter.Body;
export type ConstraintType = Matter.Constraint;
export interface BodyTag { kind: 'player' | 'platform' | 'bar' | 'crate' | 'ball' | 'rope'; owner?: number; part?: string; grabbable: boolean }
export function tag(body: BodyType, value: BodyTag): BodyType { body.plugin.grabshift = value; return body; }
export function info(body: BodyType): BodyTag | undefined { return body.plugin.grabshift; }
export const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
export const angleDelta = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
export function worldPoint(body: BodyType, point: Matter.Vector): Matter.Vector { return Vector.add(body.position, Vector.rotate(point, body.angle)); }
export function localPoint(body: BodyType, point: Matter.Vector): Matter.Vector { return Vector.rotate(Vector.sub(point, body.position), -body.angle); }
export function closestPoint(body: BodyType, point: Matter.Vector): Matter.Vector {
  if (Matter.Vertices.contains(body.vertices, point)) return { ...point };
  let best = body.position, distance = Infinity;
  for (let i = 0; i < body.vertices.length; i++) {
    const a = body.vertices[i], b = body.vertices[(i + 1) % body.vertices.length];
    const edge = Vector.sub(b, a);
    const t = clamp(Vector.dot(Vector.sub(point, a), edge) / Math.max(1, Vector.dot(edge, edge)), 0, 1);
    const candidate = Vector.add(a, Vector.mult(edge, t));
    const d = Vector.magnitude(Vector.sub(candidate, point));
    if (d < distance) { distance = d; best = candidate; }
  }
  return { ...best };
}
export function servo(body: BodyType, target: number, strength: number, damping = 0.0028): void {
  body.torque += clamp(angleDelta(target - body.angle) * strength - body.angularVelocity * damping, -0.00028, 0.00028) * body.inertia;
}
