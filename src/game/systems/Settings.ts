export interface Settings { sound: boolean; volume: number; reducedMotion: boolean }
const defaults = (): Settings => ({ sound: true, volume: 0.45, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches });
export function loadSettings(): Settings {
  const fallback = defaults();
  try {
    const data = JSON.parse(localStorage.getItem('grabshift.settings') ?? '{}');
    return { sound: typeof data.sound === 'boolean' ? data.sound : fallback.sound, volume: typeof data.volume === 'number' && Number.isFinite(data.volume) ? Math.max(0, Math.min(1, data.volume)) : fallback.volume, reducedMotion: typeof data.reducedMotion === 'boolean' ? data.reducedMotion : fallback.reducedMotion };
  } catch { return fallback; }
}
export function saveSettings(settings: Settings): void { try { localStorage.setItem('grabshift.settings', JSON.stringify(settings)); } catch { /* Private browsing still supports session settings. */ } }
