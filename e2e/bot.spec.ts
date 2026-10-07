import { test, expect, type Page } from '@playwright/test';
import type { GameScene } from '../src/game/scenes/GameScene';
import { DIFFICULTIES, type BotDifficulty } from '../src/game/match';

async function selectBot(page: Page, difficulty: BotDifficulty) {
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY GAME' }).click();
  await page.getByLabel('GAME MODE').selectOption('bot');
  await page.getByLabel('BOT DIFFICULTY').selectOption(difficulty);
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await expect(page.getByText('Your rival plays automatically.')).toBeVisible();
  await page.getByRole('button', { name: 'LET’S GRAB' }).click();
}
async function active(page: Page) {
  await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).rounds.phase)).toBe('active');
}

test('mode and difficulty selectors work with keyboard, preserve choices, and support back navigation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'PLAY GAME' }).click();
  const mode = page.getByLabel('GAME MODE'), difficulty = page.getByLabel('BOT DIFFICULTY');
  await expect(mode).toHaveValue('local');
  await expect(difficulty).toBeHidden(); await expect(difficulty).toBeDisabled();
  await mode.focus(); await page.keyboard.press('ArrowDown');
  await expect(mode).toHaveValue('bot'); await expect(difficulty).toBeVisible();
  await expect(difficulty).toHaveValue('medium');
  await difficulty.focus(); await page.keyboard.press('ArrowDown');
  await expect(difficulty).toHaveValue('hard');
  await expect(page.locator('#difficulty-description')).toContainText('Anticipates movement');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'BOT · HARD' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(difficulty).toHaveValue('hard');
  await mode.selectOption('local'); await expect(difficulty).toBeHidden();
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'PLAYER 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'CHANGE MODE' }).click();
  await mode.selectOption('bot'); await expect(difficulty).toHaveValue('hard');
  await page.setViewportSize({ width: 1024, height: 768 });
  const panel = await page.getByRole('dialog').boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0); expect(panel!.y).toBeGreaterThanOrEqual(0);
  expect(panel!.y + panel!.height).toBeLessThanOrEqual(768);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'PLAY GAME' })).toBeVisible();
});

for (const difficulty of DIFFICULTIES) {
  test(`${difficulty} bot plays automatically, ignores P2 keyboard, and pauses with the match`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    await selectBot(page, difficulty);
    await expect(page.locator('.p2 .player-label')).toHaveText(`BOT · ${difficulty.toUpperCase()}`);
    await page.evaluate(() => {
      const s = window.__GRABSHIFT__!.scene.getScene('Game') as GameScene;
      s.registry.set('botReadCount', 0);
      const read = s.bot!.read.bind(s.bot);
      s.bot!.read = sim => { s.registry.set('botReadCount', s.registry.get('botReadCount') + 1); return read(sim); };
    });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).registry.get('botReadCount'))).toBe(0);
    await active(page);
    const positions = () => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players.map(p => p.torso.position.x));
    const before = await positions();
    // Human input points P2 away from its target; only the bot should drive P2.
    await page.keyboard.down('ArrowRight'); await page.keyboard.press('k'); await page.keyboard.press('l');
    await page.keyboard.down('d');
    await expect.poll(async () => (await positions())[1]).toBeLessThan(before[1] - 20);
    await expect.poll(async () => (await positions())[0]).toBeGreaterThan(before[0] + 15);
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('d');
    await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players[1].jumps)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'HANG TIGHT.' })).toBeVisible();
    const frozen = await page.evaluate(() => {
      const s = window.__GRABSHIFT__!.scene.getScene('Game') as GameScene;
      return { time: s.simulation.time, calls: s.registry.get('botReadCount'), options: s.matchOptions };
    });
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => {
      const s = window.__GRABSHIFT__!.scene.getScene('Game') as GameScene;
      return { time: s.simulation.time, calls: s.registry.get('botReadCount'), options: s.matchOptions };
    })).toEqual(frozen);
    await page.getByRole('button', { name: 'CONTROLS', exact: true }).click();
    await expect(page.getByRole('heading', { name: `BOT · ${difficulty.toUpperCase()}` })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'RESUME', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).registry.get('botReadCount'))).toBeGreaterThan(frozen.calls);
    expect(errors).toEqual([]);
  });
}

test('bot and human wins are named correctly, rounds and rematches reset, and local mode has no leftover AI', async ({ page }) => {
  test.setTimeout(45_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await selectBot(page, 'hard'); await active(page);
  const counts = () => page.evaluate(() => { const world = (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.engine.world; return [world.bodies.length, world.constraints.length]; });
  const initial = await counts();
  for (const [round, loser] of [1, 0, 0, 0].entries()) {
    await page.evaluate(async loser => {
      const source = '/src/game/utils/physics.ts'; const { Body } = await import(source);
      const s = window.__GRABSHIFT__!.scene.getScene('Game') as GameScene;
      for (const body of s.simulation.players[loser].bodies) Body.translate(body, { x: 0, y: 500 });
    }, loser);
    await expect(page.locator('#round-message')).toContainText(loser === 1 ? 'PLAYER 1 WINS' : 'BOT WINS');
    if (round < 3) {
      await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).rounds.phase)).toBe('countdown');
      expect(await counts()).toEqual(initial); await active(page);
    }
  }
  await expect(page.getByRole('heading', { name: 'BOT WINS' })).toBeVisible();
  await expect(page.locator('.final-score')).toHaveText('1 — 3');
  await page.getByRole('button', { name: 'REMATCH' }).click();
  expect(await page.evaluate(() => {
    const s = window.__GRABSHIFT__!.scene.getScene('Game') as GameScene;
    return { options: s.matchOptions, bot: s.bot?.difficulty, score: s.rounds.scores, round: s.rounds.round };
  })).toEqual({ options: { mode: 'bot', difficulty: 'hard' }, bot: 'hard', score: [0, 0], round: 1 });
  expect(await counts()).toEqual(initial);
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'RESTART MATCH', exact: true }).click();
  expect(await page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).bot?.difficulty)).toBe('hard');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'MAIN MENU', exact: true }).click();
  await page.getByRole('button', { name: 'PLAY GAME' }).click();
  await page.getByLabel('GAME MODE').selectOption('local');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await page.getByRole('button', { name: 'LET’S GRAB' }).click(); await active(page);
  expect(await page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).bot)).toBeNull();
  await expect(page.locator('.p2 .player-label')).toHaveText('PLAYER 2');
  const x = await page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players[1].torso.position.x);
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => (window.__GRABSHIFT__!.scene.getScene('Game') as GameScene).simulation.players[1].torso.position.x)).toBeGreaterThan(x + 30);
  await page.keyboard.up('ArrowRight'); expect(errors).toEqual([]);
});
