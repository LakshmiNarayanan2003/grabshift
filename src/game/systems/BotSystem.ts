import { idleInput, TUNING, type PlayerId, type PlayerInput } from '../config';
import type { BotDifficulty } from '../match';
import type { Simulation } from './Simulation';
import { Composite, info, type BodyType } from '../utils/physics';

export const BOT_PROFILES = {
  easy: { reactionMs: 300, awareness: 95, prediction: 0, jumpMs: 1050, holdMs: 1000, recoveryMs: 1000, hesitation: 0.22, releaseSpeed: 3.8 },
  medium: { reactionMs: 150, awareness: 120, prediction: 6, jumpMs: 680, holdMs: 1250, recoveryMs: 550, hesitation: 0.04, releaseSpeed: 2.9 },
  hard: { reactionMs: 75, awareness: 145, prediction: 12, jumpMs: 420, holdMs: 750, recoveryMs: 330, hesitation: 0, releaseSpeed: 2.1 },
} as const;

/** An input-only opponent. It has the same body, forces, reach and jump rules as a human.
 * Decisions use simulation time; there are no timers, extra forces or physics mutations.
 */
export class BotSystem {
  private nextDecision = 0;
  private move = 0;
  private lastJump = -Infinity;
  private gripSince = [-1, -1];
  private lastGrip: (number | null)[] = [null, null];
  private recoverUntil = 0;
  private positionSample = 0;
  private sampledX = 0;
  private stuck = false;
  private landingTarget: number | null = null;
  private seed: number;
  readonly profile;
  constructor(readonly difficulty: BotDifficulty, seed = 0x47524142, readonly id: PlayerId = 1) {
    this.profile = BOT_PROFILES[difficulty]; this.seed = seed >>> 0;
  }
  reset(): void {
    this.nextDecision = 0; this.move = 0; this.lastJump = -Infinity;
    this.gripSince = [-1, -1]; this.lastGrip = [null, null]; this.recoverUntil = 0;
    this.positionSample = 0; this.sampledX = 0; this.stuck = false;
    this.landingTarget = null;
  }
  private random(): number { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 4294967296; }
  read(sim: Simulation): PlayerInput {
    const now = sim.time;
    if (now < this.nextDecision) return { ...idleInput(), move: this.move };
    const bot = sim.players[this.id], enemy = sim.players[this.id === 0 ? 1 : 0];
    if (!bot || !enemy) return idleInput();
    const p = bot.torso.position, velocity = bot.torso.velocity, target = enemy.torso.position;
    const bodies = Composite.allBodies(sim.engine.world);
    const platforms = bodies.filter(b => info(b)?.kind === 'platform').sort((a, b) => a.position.x - b.position.x);
    const supporting = platforms.find(b => p.x > b.bounds.min.x && p.x < b.bounds.max.x && p.y < b.bounds.min.y + 50);
    const enemyFloor = platforms.find(b => target.x > b.bounds.min.x && target.x < b.bounds.max.x);
    const nearestFloor = platforms.reduce<BodyType | undefined>((best, b) => {
      const distance = (floor: BodyType) => Math.max(floor.bounds.min.x + 45 - p.x, p.x - floor.bounds.max.x + 45, 0);
      return !best || distance(b) < distance(best) ? b : best;
    }, undefined);
    const distance = Math.hypot(target.x - p.x, target.y - p.y);
    // Basic traversal uses a shared cadence: easy should be approachable, not
    // lose to the first crate. Difficulty controls decisions once in combat.
    const navigating = distance > 200;
    const reactionMs = navigating ? 75 : this.profile.reactionMs;
    this.nextDecision = now + reactionMs;
    const predictedX = target.x + enemy.torso.velocity.x * this.profile.prediction;
    let direction = Math.sign(predictedX - p.x);
    const output = idleInput();
    if (this.landingTarget !== null && ((bot.grounded && now - this.lastJump > 350) || p.y > 530)) this.landingTarget = null;
    const opponentGrip = bot.hands.some(h => h.target && info(h.target)?.owner === enemy.id);
    const held = bot.hands.some(h => h.grabbed);
    const suspended = held && !bot.grounded;
    // Recovery takes priority over pursuit once below a platform or outside its ends.
    if (nearestFloor && (p.y > 500 || p.x < platforms[0]?.bounds.min.x + 25 || p.x > platforms.at(-1)!.bounds.max.x - 25)) {
      direction = Math.sign(nearestFloor.position.x - p.x);
    } else if (opponentGrip && enemyFloor) {
      direction = Math.sign(target.x - enemyFloor.position.x) || direction;
    }
    if (now - this.positionSample > 1100) {
      this.stuck = Math.abs(p.x - this.sampledX) < 25 && this.move !== 0;
      this.sampledX = p.x; this.positionSample = now;
    }
    output.move = direction;
    if (this.landingTarget !== null) output.move = Math.sign(this.landingTarget - p.x - velocity.x * 18);
    if (Math.abs(predictedX - p.x) < 22 && !opponentGrip && supporting) output.move = 0;
    if (this.random() < this.profile.hesitation && distance < 160 && supporting && !held) output.move = 0;

    const edgeDistance = supporting ? direction < 0 ? p.x - supporting.bounds.min.x : supporting.bounds.max.x - p.x : Infinity;
    const acrossGap = supporting && enemyFloor && supporting !== enemyFloor;
    const obstacle = bodies.some(b => info(b)?.kind === 'crate' &&
      (b.position.x - p.x) * direction > 12 && (b.position.x - p.x) * direction < 82 &&
      b.bounds.min.y > p.y && b.bounds.min.y < p.y + 120);
    // Look far enough ahead to compensate for this difficulty's reaction delay.
    const jumpApproach = 32 + Math.abs(velocity.x) * reactionMs / (1000 / 60) * 0.6;
    const nearEdge = edgeDistance < jumpApproach;
    const enemyNearEdge = enemyFloor && Math.min(target.x - enemyFloor.bounds.min.x, enemyFloor.bounds.max.x - target.x) < 100;
    const liftOpponent = opponentGrip && distance < 125 && (this.difficulty !== 'hard' || enemyNearEdge || this.stuck);
    const shouldJump = suspended || (bot.grounded && (obstacle || nearEdge || this.stuck || liftOpponent));
    if (shouldJump && now - this.lastJump >= (navigating ? 420 : this.profile.jumpMs)) {
      output.jump = true; this.lastJump = now;
      if (obstacle && acrossGap && supporting && !nearEdge) {
        this.landingTarget = direction < 0 ? supporting.bounds.min.x + 100 : supporting.bounds.max.x - 100;
      }
    }
    // At an outside edge, turn back unless crossing a real gap or wrestling a rival.
    if (nearEdge && !acrossGap && !opponentGrip && distance > 150 && supporting) output.move = Math.sign(supporting.position.x - p.x);

    bot.hands.forEach((hand, i) => {
      const key = i === 0 ? 'left' : 'right';
      const targetId = hand.target?.id ?? null;
      if (targetId !== this.lastGrip[i]) { this.lastGrip[i] = targetId; this.gripSince[i] = now; }
      const age = now - this.gripSince[i];
      if (hand.grabbed) {
        const holdingEnemy = info(hand.target!)?.owner === enemy.id;
        if (holdingEnemy) {
          const enemyEdge = enemyFloor ? Math.min(target.x - enemyFloor.bounds.min.x, enemyFloor.bounds.max.x - target.x) : 0;
          const movingOut = enemy.torso.velocity.x * direction > this.profile.releaseSpeed;
          const opportunity = this.difficulty !== 'hard' || enemyEdge < 110 || target.y > 520;
          const release = age > this.profile.holdMs && ((movingOut && opportunity) || target.y > 520 || age > this.profile.holdMs + 2200);
          if (release || (this.difficulty === 'hard' && age > 280 && enemyEdge < 45 && movingOut)) {
            output[key] = true; this.recoverUntil = now + this.profile.recoveryMs;
          }
        } else {
          const landable = supporting && p.x > supporting.bounds.min.x + 15 && p.x < supporting.bounds.max.x - 15 && p.y < supporting.bounds.min.y - 20;
          const landing = direction < 0 ? platforms.filter(b => b.bounds.max.x < p.x).at(-1) : platforms.find(b => b.bounds.min.x > p.x);
          const landingDistance = landing ? direction < 0 ? p.x - landing.bounds.max.x : landing.bounds.min.x - p.x : Infinity;
          const swingReady = age > 400 && p.y < 405 && velocity.x * direction > 2.3 && landingDistance < 135;
          const failedRecovery = age > 2600 && p.y > 530;
          if ((age > 350 && landable) || swingReady || (age > 1600 && bot.grounded) || (age > 3500 && p.y < 430) || failedRecovery) {
            output[key] = true;
            this.recoverUntil = now + (failedRecovery ? 1500 : 400);
          }
        }
      } else {
        const needAnchor = !supporting && p.y > 360 || suspended;
        const wantGrip = now >= this.recoverUntil && (distance < this.profile.awareness || needAnchor);
        // Easy wrestles with one hand; both remain available for environmental recovery.
        const useHand = i === 0 || this.difficulty !== 'easy' || (needAnchor && !opponentGrip);
        const want = wantGrip && useHand;
        if (want !== hand.armed) output[key] = true;
      }
    });
    // Never emit a normal jump faster than the character's own cooldown.
    if (now - bot.lastJump <= TUNING.jumpCooldown) output.jump = false;
    this.move = output.move;
    return output;
  }
}
