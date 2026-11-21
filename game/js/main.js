// Bootstrap: keyboard + mouse input, the animation loop, and the ?shot=
// staged scenes used for screenshots.
import { Game, STATES } from './game.js';

const canvas = document.getElementById('game-canvas');
const game = new Game(canvas, {});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  game.applyShotMode(shot);
}

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
  game.keys[key] = true;
  if (key === 'p' && game.state === STATES.PLAYING) {
    game.state = STATES.PAUSED;
    game.updateOverlays();
  } else if (key === 'p' && game.state === STATES.PAUSED) {
    game.state = STATES.PLAYING;
    game.updateOverlays();
  }
  if (key === 'm') {
    const muted = game.sfx.toggleMute();
    const el = document.getElementById('btn-mute');
    if (el) el.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
  }
  if (key === 'r' && (game.state === STATES.PLAYING || game.state === STATES.CAUGHT)) {
    game.retryLevel();
  }
  if (key === 'enter' && game.state === STATES.TITLE) game.startGame();
  if (key === 'enter' && game.state === STATES.LEVEL_CLEAR) game.nextLevel();
  if (key === 'enter' && game.state === STATES.CAUGHT) game.retryLevel();
  if (key === 'enter' && game.state === STATES.WON) game.startGame();
});

// Click the canvas to toss a coin at that spot — the clink pulls wardens over.
canvas.addEventListener('click', (e) => {
  if (game.state !== STATES.PLAYING || game.demoMode) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  if (game.player.throwCoin(x, y)) game.sfx.coinToss();
});

window.addEventListener('keyup', (e) => {
  game.keys[e.key.toLowerCase()] = false;
});

window.addEventListener('blur', () => {
  game.keys = {};
});

// Debug handle for playtesting (harmless in production).
window.__game = game;

function loop(now) {
  game.tick(now);
  requestAnimationFrame(loop);
}
game.lastTick = performance.now();
requestAnimationFrame(loop);
