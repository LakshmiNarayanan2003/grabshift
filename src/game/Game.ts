import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { WORLD, COLORS } from './config';
export function createGame() {
  return new Phaser.Game({
    // This small vector scene is faster and more predictable with Canvas2D,
    // including laptops and headless validation without a hardware GPU.
    type: Phaser.CANVAS, parent: 'game', width: WORLD.width, height: WORLD.height,
    backgroundColor: COLORS.background,
    fps: { target: 60, smoothStep: false },
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [GameScene], banner: false,
  });
}
