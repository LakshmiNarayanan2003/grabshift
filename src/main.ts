import { createGame } from './game/Game';
import './style.css';
const game = createGame();
if (import.meta.env.DEV) Object.assign(window, { __GRABSHIFT__: game });
