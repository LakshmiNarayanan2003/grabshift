import type { RoundSystem } from '../game/systems/RoundSystem';
import type { Settings } from '../game/systems/Settings';
import { saveSettings } from '../game/systems/Settings';

export interface UIActions { start(): void; resume(): void; restart(): void; menu(): void; unlock(): void }
type Screen = 'menu' | 'controls' | 'settings' | 'pause' | 'game' | 'winner';
const controls = `
  <div class="control-grid">
    <section class="player-controls p1"><div class="player-title"><span class="shape circle"></span><h3>PLAYER 1</h3><span>THE CIRCLE</span></div>
      <div class="key-line"><span><kbd>A</kbd><kbd>D</kbd></span><span>Move / swing</span></div>
      <div class="key-line"><span><kbd>W</kbd></span><span>Jump / climb</span></div>
      <div class="key-line"><span><kbd>F</kbd><kbd>G</kbd></span><span>Left / right grip</span></div></section>
    <section class="player-controls p2"><div class="player-title"><span class="shape diamond"></span><h3>PLAYER 2</h3><span>THE DIAMOND</span></div>
      <div class="key-line"><span><kbd>←</kbd><kbd>→</kbd></span><span>Move / swing</span></div>
      <div class="key-line"><span><kbd>↑</kbd></span><span>Jump / climb</span></div>
      <div class="key-line"><span><kbd>K</kbd><kbd>L</kbd></span><span>Left / right grip</span></div></section>
  </div>`;

export class UI {
  readonly root = document.querySelector<HTMLDivElement>('#ui')!;
  screen: Screen = 'menu';
  private returnTo: 'menu' | 'pause' = 'menu';
  private lastHud = '';
  private click = (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!button) return;
    this.actions.unlock();
    switch (button.dataset.action) {
      case 'play': this.showControls('menu', true); break;
      case 'start': this.actions.start(); this.showGame(); break;
      case 'controls': this.showControls(this.screen === 'pause' ? 'pause' : 'menu'); break;
      case 'settings': this.showSettings(); break;
      case 'back': this.returnTo === 'pause' ? this.showPause() : this.showMenu(); break;
      case 'resume': this.actions.resume(); this.showGame(); break;
      case 'restart': this.actions.restart(); this.showGame(); break;
      case 'menu': this.actions.menu(); this.showMenu(); break;
    }
  };
  private focusTrap = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || this.screen === 'game') return;
    const elements = [...this.root.querySelectorAll<HTMLElement>('button, input, a[href]')];
    if (!elements.length) return;
    if (event.shiftKey && (document.activeElement === elements[0] || !this.root.contains(document.activeElement))) { event.preventDefault(); elements.at(-1)!.focus(); }
    else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus(); }
  };
  constructor(private actions: UIActions, private settings: Settings) { this.root.addEventListener('click', this.click); this.root.addEventListener('keydown', this.focusTrap); this.showMenu(); }
  private render(html: string, screen: Screen): void {
    this.screen = screen; this.root.innerHTML = html; this.root.className = screen === 'game' ? 'playing' : '';
    this.root.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }
  showMenu(): void {
    this.render(`<main class="main-menu" aria-label="Main menu">
      <header class="brand-bar"><span class="brand"><span class="brand-mark">↯</span> GRABSHIFT</span><span class="edition">LOCAL MULTIPLAYER <i></i> V1.0</span></header>
      <div class="menu-copy"><p class="eyebrow"><span></span> A PHYSICS BRAWLER FOR TWO</p><h1>HOLD ON.<br><em>LET LOOSE.</em></h1>
      <p class="intro">Two hands. No punches. No promises.<br>Grab your rival. Find your momentum.<br>Try not to fall.</p>
      <button class="primary play" data-action="play">PLAY LOCAL <span aria-hidden="true">→</span></button>
      <div class="menu-links"><button data-action="controls">How to play <span aria-hidden="true">→</span></button><button data-action="settings">Settings <span aria-hidden="true">⌘</span></button></div>
      <p class="keyboard-note"><span>⌨</span> 2 PLAYERS · 1 KEYBOARD · FIRST TO 3</p></div>
      <div class="menu-art"><img src="${import.meta.env.BASE_URL}keyart.svg" alt="Two geometric ragdolls swing above an industrial pit, reaching for each other."/><div class="arena-tag"><span>01 / THE PIT</span><small>YOUR FRIENDSHIP'S STRESS TEST.</small></div></div>
      <footer class="menu-footer"><span>BUILT ON MOMENTUM.</span><span>FREE & OPEN SOURCE <span class="footer-dot">●</span> NO DOWNLOAD REQUIRED</span></footer>
    </main>`, 'menu');
  }
  showControls(from: 'menu' | 'pause', starting = false): void {
    this.returnTo = from;
    this.render(`<section class="overlay"><div class="panel controls-panel" role="dialog" aria-modal="true" aria-labelledby="controls-title">
      <p class="eyebrow">THE RULES ARE SIMPLE</p><h2 id="controls-title">GET A GRIP.</h2><p class="panel-subtitle">Keep yourself in. Throw your friend out.</p>
      ${controls}
      <div class="rules"><p><b>01</b><span>Tap a grip key to reach and latch onto something nearby. Tap again to release.</span></p><p><b>02</b><span>Grab your rival, crates, ledges, or the hanging rig. Move to build a swing; jump while gripping to climb.</span></p><p><b>03</b><span>Release at the top of your swing. Momentum does the throwing. First to 3 wins.</span></p></div>
      <div class="panel-bottom"><span><kbd>ESC</kbd> Pause anytime</span><button class="primary" data-action="${starting ? 'start' : 'back'}">${starting ? 'LET’S GRAB' : 'GOT IT'} <span aria-hidden="true">→</span></button></div>
      <p class="fineprint">Grip glow: pulsing = reaching · lime = holding. Some keyboards limit simultaneous keys.</p>
    </div></section>`, 'controls');
  }
  showSettings(): void {
    this.returnTo = 'menu';
    this.render(`<section class="overlay"><div class="panel compact" role="dialog" aria-modal="true" aria-labelledby="settings-title"><p class="eyebrow">MAKE YOURSELF AT HOME</p><h2 id="settings-title">SETTINGS</h2>
      <label class="setting-row"><span>Sound effects<small>Original synthesized grab & impact sounds</small></span><input id="sound" type="checkbox" ${this.settings.sound ? 'checked' : ''}></label>
      <label class="setting-row"><span>Volume</span><input id="volume" aria-label="Volume" type="range" min="0" max="1" step="0.05" value="${this.settings.volume}"></label>
      <label class="setting-row"><span>Reduced motion<small>Fewer particles; no camera shake or throw slowdown</small></span><input id="motion" type="checkbox" ${this.settings.reducedMotion ? 'checked' : ''}></label>
      <button class="primary full" data-action="back">BACK TO MENU <span aria-hidden="true">←</span></button><p class="fineprint">Saved on this device. Keyboard play works best on a desktop.</p>
    </div></section>`, 'settings');
    this.root.querySelector('#sound')!.addEventListener('change', event => { this.settings.sound = (event.target as HTMLInputElement).checked; this.actions.unlock(); saveSettings(this.settings); });
    this.root.querySelector('#volume')!.addEventListener('input', event => { this.settings.volume = Number((event.target as HTMLInputElement).value); saveSettings(this.settings); });
    this.root.querySelector('#motion')!.addEventListener('change', event => { this.settings.reducedMotion = (event.target as HTMLInputElement).checked; saveSettings(this.settings); });
  }
  showPause(): void {
    this.returnTo = 'pause';
    this.render(`<section class="overlay"><div class="panel compact pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title"><p class="eyebrow">TAKE A BREATHER</p><h2 id="pause-title">HANG TIGHT.</h2><p class="panel-subtitle">Your momentum can wait.</p><button class="primary full" data-action="resume">RESUME <span aria-hidden="true">→</span></button><button class="secondary" data-action="restart">RESTART MATCH</button><button class="secondary" data-action="controls">CONTROLS</button><button class="secondary" data-action="menu">MAIN MENU</button><p class="fineprint"><kbd>ESC</kbd> to resume</p></div></section>`, 'pause');
  }
  showGame(): void {
    this.lastHud = '';
    this.render(`<div class="hud"><div class="score p1"><span class="shape circle"></span><div><span class="player-label">PLAYER 1</span><div id="score-0" class="score-dots" aria-label="Player 1 score"></div></div></div><div class="round-label"><span id="round-number">ROUND 1</span><small>FIRST TO THREE</small></div><div class="score p2"><div><span class="player-label">PLAYER 2</span><div id="score-1" class="score-dots" aria-label="Player 2 score"></div></div><span class="shape diamond"></span></div></div><div id="round-message" class="round-message" role="status" aria-live="polite"></div>`, 'game');
    (document.activeElement as HTMLElement | null)?.blur();
  }
  update(rounds: RoundSystem): void {
    if (this.screen !== 'game') return;
    const signature = `${rounds.scores}|${rounds.round}|${rounds.phase}|${rounds.countdown}|${rounds.winner}|${rounds.draw}`;
    if (signature === this.lastHud) return;
    this.lastHud = signature;
    if (rounds.phase === 'matchOver') { this.showWinner(rounds); return; }
    for (const id of [0, 1]) {
      const score = this.root.querySelector<HTMLElement>(`#score-${id}`)!;
      score.innerHTML = [0, 1, 2].map(i => `<span class="score-dot ${rounds.scores[id] > i ? 'won' : ''}"></span>`).join('');
      score.setAttribute('aria-label', `Player ${id + 1}: ${rounds.scores[id]} of 3 wins`);
    }
    this.root.querySelector('#round-number')!.textContent = `ROUND ${rounds.round}`;
    const message = this.root.querySelector<HTMLElement>('#round-message')!;
    message.className = `round-message ${rounds.phase === 'resolving' ? 'result-message' : ''}`;
    message.innerHTML = rounds.phase === 'resolving' ? `<small>${rounds.draw ? 'NOBODY HELD ON' : 'ROUND SECURED'}</small><strong>${rounds.draw ? 'DOUBLE DROP' : `PLAYER ${rounds.winner! + 1} WINS`}</strong><span>${rounds.draw ? 'Same round. Another chance.' : 'A little grip goes a long way.'}</span>` : rounds.countdown ? `<small>${rounds.phase === 'countdown' ? 'GET READY' : ''}</small><strong>${rounds.countdown}</strong>` : '';
  }
  private showWinner(rounds: RoundSystem): void {
    const winner = rounds.winner! + 1;
    this.render(`<section class="overlay"><div class="panel compact winner-panel p${winner}" role="dialog" aria-modal="true" aria-labelledby="winner-title"><span class="winner-symbol">${winner === 1 ? '●' : '◆'}</span><p class="eyebrow">LAST ONE HOLDING</p><h2 id="winner-title">PLAYER ${winner}<br>WINS</h2><p class="final-score">${rounds.scores[0]} <span>—</span> ${rounds.scores[1]}</p><button class="primary full" data-action="restart">REMATCH <span aria-hidden="true">→</span></button><button class="secondary" data-action="menu">MAIN MENU</button></div></section>`, 'winner');
  }
  escape(): void { if (this.screen === 'controls' && this.returnTo === 'pause') this.showPause(); else if (this.screen === 'controls' || this.screen === 'settings') this.showMenu(); }
  dispose(): void { this.root.removeEventListener('click', this.click); this.root.removeEventListener('keydown', this.focusTrap); this.root.innerHTML = ''; }
}
