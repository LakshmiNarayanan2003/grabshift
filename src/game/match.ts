export type MatchMode = 'local' | 'bot';
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export interface MatchOptions { mode: MatchMode; difficulty: BotDifficulty }
export const defaultMatch = (): MatchOptions => ({ mode: 'local', difficulty: 'medium' });
export const DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'medium', 'hard'];
export const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;
export const DIFFICULTY_DESCRIPTIONS = {
  easy: 'A relaxed sparring partner. Slower reactions, one-handed grabs, and more chances to escape.',
  medium: 'An active challenger. Uses both hands, crosses the pit, and builds momentum before releasing.',
  hard: 'A persistent rival. Anticipates movement, reacts quickly, and times releases near arena edges.',
} as const;
export function playerName(id: number, options: MatchOptions): string {
  return id === 1 && options.mode === 'bot' ? 'BOT' : `PLAYER ${id + 1}`;
}
