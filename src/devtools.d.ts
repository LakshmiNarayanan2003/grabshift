import type Phaser from 'phaser';
declare global {
  interface Window { __GRABSHIFT__?: Phaser.Game }
}
export {};
