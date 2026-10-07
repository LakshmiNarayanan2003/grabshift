import { test, expect, type Page } from '@playwright/test';
import type { GameScene } from '../src/game/scenes/GameScene';

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY GAME' }).click();
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'GET A GRIP.' })).toBeVisible();
  await page.getByRole('button', { name: 'LET’S GRAB' }).click();
  await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).rounds.phase)).toBe('active');
}

test('real keyboard movement, grounded jump, pause, focus loss, and resize', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  await start(page);
  const positions = () => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players.map(p => ({ x: p.torso.position.x, y: p.torso.position.y, jumps: p.jumps })));
  const before = await positions();
  await page.keyboard.down('d'); await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await positions())[0].x - before[0].x).toBeGreaterThan(35);
  await page.keyboard.up('d'); await page.keyboard.up('ArrowLeft');
  const moved = await positions();
  expect(moved[1].x).toBeLessThan(before[1].x - 30);
  await page.keyboard.press('w'); await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await positions()).map(p => p.jumps)).toEqual([1, 1]);
  await expect.poll(async () => (await positions())[0].y).toBeLessThan(moved[0].y - 25);
  await page.keyboard.press('w');
  expect((await positions())[0].jumps).toBe(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'RESUME', exact: true })).toBeVisible();
  const frozen = await positions();
  await page.waitForTimeout(150);
  expect(await positions()).toEqual(frozen);
  await page.setViewportSize({ width: 1024, height: 768 });
  const box = await page.locator('canvas').boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(16 / 9, 2);
  expect(await positions()).toEqual(frozen);
  await page.getByRole('button', { name: 'CONTROLS', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'RESUME', exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('heading', { name: 'HANG TIGHT.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('physical keyboard toggles both players’ hands independently on environmental objects', async ({ page }) => {
  await start(page);
  await page.evaluate(async () => {
    const source = '/src/game/utils/physics.ts';
    const { Bodies, Composite, tag } = await import(source);
    const scene = window.__GRABSHIFT__!.scene.getScene('Game') as GameScene;
    for (const player of scene.simulation.players) for (const hand of player.hands) {
      const crate = tag(Bodies.rectangle(hand.point.x, hand.point.y, 18, 18, { isStatic: true }), { kind: 'crate', grabbable: true });
      Composite.add(scene.simulation.engine.world, crate);
    }
    // Isolate a repeatable interaction; the real key handlers still perform every grab/release.
    scene.simulation.engine.gravity.y = 0;
  });
  const grips = () => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players.map(p => p.hands.map(h => h.grabbed)));
  for (const key of ['f', 'g', 'k', 'l']) await page.keyboard.press(key);
  await expect.poll(grips).toEqual([[true, true], [true, true]]);
  await page.keyboard.press('f');
  await expect.poll(grips).toEqual([[false, true], [true, true]]);
  for (const key of ['g', 'k', 'l']) await page.keyboard.press(key);
  await expect.poll(grips).toEqual([[false, false], [false, false]]);
});

test('natural approach can jump, reach, and grab a loose arena crate', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await start(page);
  await page.keyboard.down('d');
  await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players[0].torso.position.x)).toBeGreaterThan(358);
  await page.keyboard.up('d'); await page.keyboard.press('g');
  await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players[0].hands[1].target?.plugin.grabshift.kind)).toBe('crate');
  await page.keyboard.press('w');
  await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players[0].jumps)).toBe(1);
  await page.keyboard.press('g');
  await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players[0].hands[1].grabbed)).toBe(false);
  expect(errors).toEqual([]);
});

test('a complete match scores, resets, wins, rematches, and returns to menu without leaks', async ({ page }) => {
  await start(page);
  const counts = () => page.evaluate(() => {
    const s = window.__GRABSHIFT__!.scene.getScene('Game') as GameScene;
    return [s.simulation.engine.world.bodies.length, s.simulation.engine.world.constraints.length];
  });
  const initial = await counts();
  for (let point = 1; point <= 3; point++) {
    await page.evaluate(async () => {
      const source = '/src/game/utils/physics.ts'; const { Body } = await import(source);
      const s = window.__GRABSHIFT__!.scene.getScene('Game') as GameScene;
      for (const body of s.simulation.players[1].bodies) Body.translate(body, { x: 0, y: 500 });
    });
    await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).rounds.scores[0])).toBe(point);
    if (point < 3) {
      await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).rounds.phase)).toBe('countdown');
      expect(await counts()).toEqual(initial);
      await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).rounds.phase)).toBe('active');
    }
  }
  await expect(page.getByRole('heading', { name: 'PLAYER 1 WINS' })).toBeVisible();
  await page.getByRole('button', { name: 'REMATCH' }).click();
  expect(await page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).rounds.scores)).toEqual([0, 0]);
  expect(await counts()).toEqual(initial);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  await expect(page.getByRole('button', { name: 'PLAY GAME' })).toBeVisible();
});

test('settings persist, menu supports keyboard navigation, F3 is development only', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#sound').uncheck(); await page.locator('#motion').check();
  await page.reload(); await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('#sound')).not.toBeChecked(); await expect(page.locator('#motion')).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'PLAY GAME' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'GAME MODE' })).toBeFocused();
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'GET A GRIP.' })).toBeVisible();
  await page.keyboard.press('F3');
  await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).debug)).toBe(true);
});
