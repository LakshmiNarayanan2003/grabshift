import { idleInput, type PlayerInput } from '../config';

export class InputSystem {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private readonly codes = new Set(['KeyA', 'KeyD', 'KeyW', 'KeyF', 'KeyG', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyK', 'KeyL', 'Escape', 'F3']);
  private keydown = (e: KeyboardEvent) => {
    if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) && e.code !== 'Escape') return;
    if (!this.codes.has(e.code)) return;
    e.preventDefault();
    if (!e.repeat && !this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
  };
  private keyup = (e: KeyboardEvent) => { this.down.delete(e.code); };
  clear = () => { this.down.clear(); this.pressed.clear(); };
  constructor() { window.addEventListener('keydown', this.keydown); window.addEventListener('keyup', this.keyup); window.addEventListener('blur', this.clear); }
  take(code: string) { const had = this.pressed.has(code); this.pressed.delete(code); return had; }
  read(): [PlayerInput, PlayerInput] {
    const player = (left: string, right: string, jump: string, handA: string, handB: string): PlayerInput => ({
      move: Number(this.down.has(right)) - Number(this.down.has(left)), jump: this.take(jump), left: this.take(handA), right: this.take(handB),
    });
    return [player('KeyA', 'KeyD', 'KeyW', 'KeyF', 'KeyG'), player('ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyK', 'KeyL')];
  }
  idle(): [PlayerInput, PlayerInput] { return [idleInput(), idleInput()]; }
  dispose() { window.removeEventListener('keydown', this.keydown); window.removeEventListener('keyup', this.keyup); window.removeEventListener('blur', this.clear); this.clear(); }
}
