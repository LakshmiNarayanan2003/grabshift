import type { HandSide } from '../config';
import { worldPoint, type BodyType, type ConstraintType } from '../utils/physics';

export class Hand {
  armed = false;
  constraint: ConstraintType | null = null;
  target: BodyType | null = null;
  constructor(readonly side: HandSide, readonly body: BodyType) {}
  get point() { return worldPoint(this.body, { x: 0, y: 17 }); }
  get grabbed() { return this.constraint !== null; }
}
