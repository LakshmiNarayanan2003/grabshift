import Phaser from 'phaser';
import { COLORS, TUNING } from '../config';
import type { Simulation } from '../systems/Simulation';
import type { EffectsSystem } from '../systems/EffectsSystem';
import { Composite, Vector, info, worldPoint, type BodyType } from '../utils/physics';

export class ArenaRenderer {
  private g: Phaser.GameObjects.Graphics;
  private debugText: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    const bg = scene.add.graphics();
    bg.fillStyle(0x0c111a); bg.fillRect(0, 0, 1280, 720);
    bg.fillGradientStyle(0x17242b, 0x17242b, 0x0c111a, 0x0c111a, 1); bg.fillRect(0, 90, 1280, 540);
    bg.lineStyle(1, 0x728a8b, 0.045);
    for (let x = 0; x < 1280; x += 40) bg.lineBetween(x, 110, x, 720);
    for (let y = 110; y < 720; y += 40) bg.lineBetween(0, y, 1280, y);
    bg.lineStyle(2, 0x334348, 0.5);
    bg.strokeRoundedRect(54, 145, 1172, 550, 16);
    for (const x of [120, 1160]) { bg.lineBetween(x, 148, x, 495); bg.lineBetween(x - 5, 180, x + 5, 180); }
    bg.fillStyle(0x0a1018); bg.fillRect(553, 552, 174, 168);
    bg.lineStyle(1, 0xd9f978, 0.12); bg.lineBetween(553, 576, 553, 720); bg.lineBetween(727, 576, 727, 720);
    for (let y = 605; y < 750; y += 33) { bg.lineStyle(2, 0xd9f978, 0.11); bg.lineBetween(625, y, 640, y + 9); bg.lineBetween(640, y + 9, 655, y); }
    const label = (x: number, y: number, text: string, size: number, color: string, spacing = 4) => scene.add.text(x, y, text, { fontFamily: 'monospace', fontSize: `${size}px`, color, letterSpacing: spacing }).setOrigin(0.5);
    label(640, 157, 'THE PIT', 12, '#708583', 8);
    label(640, 183, 'INDUSTRIAL PLAYGROUND / 01', 8, '#45595e', 2);
    label(310, 660, '01  /  HOLD YOUR GROUND', 10, '#405359', 2);
    label(970, 660, '02  /  LET GO AT THE RIGHT TIME', 10, '#405359', 2);
    this.g = scene.add.graphics();
    this.debugText = scene.add.text(20, 686, '', { fontSize: '11px', fontFamily: 'monospace', color: '#d9f978' }).setDepth(20);
  }
  draw(sim: Simulation, effects: EffectsSystem, debug: boolean, time: number): void {
    const g = this.g; g.clear();
    const bodies = Composite.allBodies(sim.engine.world);
    for (const c of sim.arena?.cables ?? []) {
      const a = c.bodyA ? Vector.add(c.bodyA.position, c.pointA) : c.pointA;
      const b = c.bodyB ? Vector.add(c.bodyB.position, c.pointB) : c.pointB;
      g.lineStyle(c.label === 'cable' ? 3 : 2, 0x637774); g.lineBetween(a.x, a.y, b.x, b.y);
      if (!c.bodyA) { g.fillStyle(0xd9f978); g.fillCircle(a.x, a.y, 5); g.lineStyle(2, 0x344741); g.strokeCircle(a.x, a.y, 11); }
    }
    for (const b of bodies.filter(b => info(b)?.kind !== 'player')) this.environment(b);
    for (const player of sim.players) {
      const color = player.id === 0 ? COLORS.p1 : COLORS.p2;
      for (const b of [...player.lowerLegs, ...player.upperLegs, ...player.upperArms, ...player.hands.map(h => h.body), player.torso, player.head]) {
        // A tiny render-only compression on impact adds weight without distorting physics.
        const flash = effects.isFlashing(b.id);
        const vertices = flash ? b.vertices.map(v => ({ x: b.position.x + (v.x - b.position.x) * 1.055, y: b.position.y + (v.y - b.position.y) * 0.945 })) : b.vertices;
        g.fillStyle(0x05080c, 0.45); g.fillPoints(vertices.map(v => ({ x: v.x + 4, y: v.y + 5 })), true);
        const secondary = info(b)?.part?.includes('upper') || info(b)?.part?.includes('lower');
        g.fillStyle(flash ? COLORS.white : secondary ? player.id === 0 ? 0x418b85 : 0xb56c51 : color);
        g.fillPoints(vertices, true); g.lineStyle(1.5, 0x07151b, 0.75); g.strokePoints(vertices, true);
      }
      for (const joint of player.joints) {
        const a = Vector.add(joint.bodyA!.position, joint.pointA);
        g.fillStyle(color, 0.65); g.fillCircle(a.x, a.y, 3);
      }
      const center = player.torso.position;
      const badge = worldPoint(player.torso, { x: 0, y: -3 });
      g.fillStyle(0x0d2025, 0.8);
      if (player.id === 0) g.fillCircle(badge.x, badge.y, 7);
      else g.fillPoints([{ x: badge.x, y: badge.y - 8 }, { x: badge.x + 7, y: badge.y }, { x: badge.x, y: badge.y + 8 }, { x: badge.x - 7, y: badge.y }], true);
      const head = player.head;
      for (const x of [-6, 6]) {
        const eye = worldPoint(head, { x: x + player.facing * 2, y: -2 });
        g.fillStyle(0x10232a);
        if (player.id === 0) g.fillCircle(eye.x, eye.y, 2.5);
        else g.fillRect(eye.x - 3, eye.y - 2, 6, 3);
      }
      const mouth = worldPoint(head, { x: player.facing * 2, y: 7 });
      g.lineStyle(1.5, 0x10232a); g.lineBetween(mouth.x - 3, mouth.y, mouth.x + 3, mouth.y + (head.speed > 7 ? 2 : 0));
      if (player.id === 1) {
        const a = worldPoint(head, { x: -14, y: -10 }), b = worldPoint(head, { x: 14, y: -10 });
        g.lineStyle(4, 0xffe0b4); g.lineBetween(a.x, a.y, b.x, b.y);
      } else {
        const dot = worldPoint(head, { x: 0, y: -13 }); g.fillStyle(0xd5fff4); g.fillCircle(dot.x, dot.y, 3);
      }
      for (const hand of player.hands) {
        const p = hand.point;
        if (hand.armed) {
          g.lineStyle(1, hand.grabbed ? COLORS.lime : color, 0.25 + Math.sin(time / 100) * 0.08);
          g.strokeCircle(p.x, p.y, hand.grabbed ? 15 : 18);
        }
        g.fillStyle(hand.grabbed ? COLORS.lime : color); g.fillCircle(p.x, p.y, hand.grabbed ? 6 : 4.5);
        g.lineStyle(1.5, 0x0c111a); g.strokeCircle(p.x, p.y, hand.grabbed ? 6 : 4.5);
        if (hand.constraint) {
          const c = hand.constraint, end = Vector.add(c.bodyB!.position, c.pointB);
          g.lineStyle(2.5, COLORS.lime); g.lineBetween(p.x, p.y, end.x, end.y);
        }
      }
      // A small ground shadow anchors the character without scaling physics geometry.
      if (player.grounded) { g.fillStyle(color, 0.12); g.fillEllipse(center.x, 545, 47, 5); }
    }
    effects.draw(g);
    if (debug) {
      g.lineStyle(1, 0xf4e275, 0.7);
      for (const b of bodies) g.strokePoints(b.vertices, true);
      for (const c of Composite.allConstraints(sim.engine.world)) {
        const a = c.bodyA ? Vector.add(c.bodyA.position, c.pointA) : c.pointA, b = c.bodyB ? Vector.add(c.bodyB.position, c.pointB) : c.pointB;
        g.lineStyle(1, 0xf06fbe, 0.8); g.lineBetween(a.x, a.y, b.x, b.y);
      }
      for (const p of sim.players) for (const h of p.hands) { g.lineStyle(1, 0x7bddfa, 0.6); g.strokeCircle(h.point.x, h.point.y, TUNING.grabRadius); }
      this.debugText.setText(sim.players.map(p => `P${p.id + 1} v=(${p.torso.velocity.x.toFixed(1)},${p.torso.velocity.y.toFixed(1)}) ground=${p.grounded}`).join('   |   ') + `   bodies=${bodies.length} constraints=${Composite.allConstraints(sim.engine.world).length}`);
    } else this.debugText.setText('');
  }
  private environment(b: BodyType): void {
    const g = this.g, kind = info(b)?.kind;
    g.fillStyle(0x03080d, 0.4); g.fillPoints(b.vertices.map(v => ({ x: v.x + 5, y: v.y + 7 })), true);
    g.fillStyle(kind === 'crate' ? 0x706c4d : kind === 'ball' ? 0x43525b : kind === 'rope' ? 0x8fa292 : 0x28383e);
    g.fillPoints(b.vertices, true); g.lineStyle(2, kind === 'crate' ? 0xb6af7a : kind === 'ball' ? 0x83939a : 0x455b5d); g.strokePoints(b.vertices, true);
    if (kind === 'platform' || kind === 'bar') {
      const top = b.bounds.min.y;
      g.fillStyle(COLORS.lime, 0.85); g.fillRoundedRect(b.bounds.min.x + 4, top, b.bounds.max.x - b.bounds.min.x - 8, 4, 2);
      if (kind === 'platform') {
        g.fillStyle(0x131f27); g.fillRect(b.bounds.min.x + 10, top + 20, b.bounds.max.x - b.bounds.min.x - 20, 38);
        for (let x = b.bounds.min.x + 22; x < b.bounds.max.x - 10; x += 32) { g.lineStyle(3, 0x526354, 0.5); g.lineBetween(x, top + 34, x + 11, top + 24); }
        for (const x of [b.bounds.min.x + 10, b.bounds.max.x - 10]) { g.fillStyle(0x92a49b); g.fillCircle(x, top + 11, 2); }
      }
    }
    if (kind === 'crate') {
      const size = b.label === 'Rectangle Body' ? (b.vertices[1] ? Vector.magnitude(Vector.sub(b.vertices[2], b.vertices[1])) : 20) : 20;
      const half = Math.max(13, Math.min(size, 20));
      g.lineStyle(2, 0xb6af7a, 0.75);
      for (const sign of [-1, 1]) { const a = worldPoint(b, { x: -half, y: sign * half }), c = worldPoint(b, { x: half, y: -sign * half }); g.lineBetween(a.x, a.y, c.x, c.y); }
      g.fillStyle(0xe1dca4); g.fillCircle(b.position.x, b.position.y, 2);
    }
    if (kind === 'ball') { g.lineStyle(2, 0x9cacb0, 0.4); g.strokeCircle(b.position.x, b.position.y, 19); g.fillStyle(COLORS.lime); g.fillCircle(b.position.x, b.position.y, 4); }
  }
}
