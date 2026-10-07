export const WORLD = { width: 1280, height: 720, floor: 548, deathY: 780, step: 1000 / 60 } as const;
export const TUNING = {
  moveForce: 0.00082,
  airControl: 0.46,
  maxSpeed: 7.5,
  jumpSpeed: 10.6,
  coyoteMs: 110,
  jumpCooldown: 280,
  grabRadius: 30,
  reachRadius: 135,
  grabStiffness: 0.64,
  grabDamping: 0.12,
  posture: 0.000055,
  angularDamping: 0.0028,
} as const;
export const COLORS = { p1: 0x77e2d2, p2: 0xffac78, lime: 0xd9f978, white: 0xeaf1ed, background: 0x0c111a } as const;
export type PlayerId = 0 | 1;
export type HandSide = 'left' | 'right';
export interface PlayerInput { move: number; jump: boolean; left: boolean; right: boolean }
export const idleInput = (): PlayerInput => ({ move: 0, jump: false, left: false, right: false });
