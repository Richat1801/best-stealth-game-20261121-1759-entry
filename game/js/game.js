// The Velvet Hour — game state, loop, detection wiring, HUD and scoring.
// States: title → playing → levelclear → won / caught. A `?shot=` URL
// parameter freezes a staged scene for screenshots (same code, same render).
import { TILE, LEVELS, parseLevel, tileAt } from './levels.js';
import { Guard, Camera, GUARD_STATES, hasLineOfSight } from './guards.js';
import { Player } from './player.js';
import { Renderer } from './render.js';
import { SoundFX } from './audio.js';

export const STATES = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  LEVEL_CLEAR: 'levelclear',
  CAUGHT: 'caught',
  WON: 'won',
};

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.hud = hud;
    this.sfx = new SoundFX();
    this.keys = {};
    this.state = STATES.TITLE;
    this.levelIndex = 0;
    this.score = 0;
    this.totalTime = 0;
    this.levelTime = 0;
    this.gemsTaken = 0;
    this.gemsTotal = 0;
    this.alertsThisLevel = 0;
    this.alarmLevel = 0;
    this.alarmTimer = 0;
    this.particles = [];
    this.time = 0;
    this.lastTick = 0;
    this.demoMode = null;
    this.shake = 0;
    this.message = '';
    this.messageTimer = 0;
    this.noiseEvents = [];
    this.loadLevel(0);
    this.bindHudButtons();
  }

  loadLevel(index) {
    this.levelIndex = index;
    const def = LEVELS[index];
    const parsed = parseLevel(def);
    this.grid = parsed.grid;
    this.player = new Player(parsed.playerStart);
    this.exit = parsed.exit;
    this.gems = parsed.gems.map((g) => ({ ...g, taken: false }));
    this.guards = def.guards.map((g) => new Guard(g));
    this.cameras = (def.cameras || []).map((c) => new Camera(c));
    this.gemsTotal = this.gems.length;
    this.gemsTaken = 0;
    this.levelTime = 0;
    this.alertsThisLevel = 0;
    this.alarmLevel = 0;
    this.alarmTimer = 0;
    this.particles = [];
    this.noiseEvents = [];
    this.exitOpen = false;
    this.updateHud();
  }

  startGame() {
    this.score = 0;
    this.totalTime = 0;
    this.loadLevel(0);
    this.state = STATES.PLAYING;
    this.sfx.ensure();
    this.sfx.startMusic();
    this.showMessage(LEVELS[0].briefing, 6);
    this.updateHud();
    this.updateOverlays();
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = STATES.WON;
      this.sfx.victory();
      this.sfx.stopMusic();
    } else {
      this.loadLevel(this.levelIndex + 1);
      this.state = STATES.PLAYING;
      this.showMessage(LEVELS[this.levelIndex].briefing, 6);
    }
    this.updateHud();
    this.updateOverlays();
  }

  retryLevel() {
    this.loadLevel(this.levelIndex);
    this.state = STATES.PLAYING;
    this.updateHud();
    this.updateOverlays();
  }

  // One frame. dt is clamped so a tab switch never teleports anyone.
  tick(now) {
    const dt = Math.min(0.05, (now - this.lastTick) / 1000 || 0.016);
    this.lastTick = now;
    if (this.state === STATES.PLAYING && !this.demoMode) {
      this.time += dt;
      this.levelTime += dt;
      this.totalTime += dt;
      this.update(dt);
    } else if (this.demoMode) {
      this.time += dt; // keep cones and gems gently animated in staged shots
    }
    this.updateParticles(dt);
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }
    this.renderer.draw(this.snapshot());
    if (this.state === STATES.PLAYING) this.updateHud();
  }

  snapshot() {
    return {
      grid: this.grid,
      player: this.player,
      guards: this.guards,
      cameras: this.cameras,
      gems: this.gems,
      exit: this.exit,
      exitOpen: this.exitOpen,
      time: this.time,
      particles: this.particles,
      alarmLevel: this.alarmLevel,
    };
  }

  update(dt) {
    const move = this.player.update(dt, this.keys, this.grid);
    if (move && move.coinLanded) {
      this.sfx.coinLand();
      this.noiseEvents.push({ x: move.coinLanded.x, y: move.coinLanded.y, radius: 190, life: 0.6 });
      for (const g of this.guards) g.hearNoise(move.coinLanded.x, move.coinLanded.y, 190);
    }

    // Running is loud: nearby wardens come to look.
    if (this.player.stance === 'run' && this.player.moving) {
      this.noiseEvents.push({ x: this.player.x, y: this.player.y, radius: this.player.noiseRadius, life: 0.12 });
      for (const g of this.guards) g.hearNoise(this.player.x, this.player.y, this.player.noiseRadius);
    }

    let anyAlert = false;
    let anySees = false;
    for (const g of this.guards) {
      const wasAlert = g.state === GUARD_STATES.ALERT;
      g.update(dt, this.player, this.grid, (guard) => this.onSpotted(guard));
      if (g.state === GUARD_STATES.ALERT) anyAlert = true;
      if (g.detection > 0) anySees = true;
      // Footsteps: a soft pip from the warden's side of the screen.
      if (g.stepPhase > 34) {
        g.stepPhase = 0;
        const pan = Math.max(-1, Math.min(1, (g.x - this.player.x) / 300));
        this.sfx.footstep(pan, g.state === GUARD_STATES.ALERT);
      }
      // Caught?
      if (g.state === GUARD_STATES.ALERT && Math.hypot(g.x - this.player.x, g.y - this.player.y) < 28) {
        this.onCaught();
        return;
      }
      if (!wasAlert && g.state === GUARD_STATES.ALERT) this.alertsThisLevel += 1;
    }
    for (const cam of this.cameras) {
      cam.update(dt, this.player, this.grid, () => this.onCameraTripped(cam));
      if (cam.tripped) anyAlert = true;
    }

    // Alarm: rises while any warden hunts, fades once they lose you.
    if (anyAlert) {
      this.alarmLevel = 1;
      this.alarmTimer = 0;
    } else {
      this.alarmTimer += dt;
      if (this.alarmTimer > 4) this.alarmLevel = Math.max(0, this.alarmLevel - dt * 0.25);
    }
    if (anySees) this.alarmTimer = 0;

    // Gems.
    for (const g of this.gems) {
      if (!g.taken && Math.hypot(g.x * TILE + 20 - this.player.x, g.y * TILE + 20 - this.player.y) < 26) {
        g.taken = true;
        this.gemsTaken += 1;
        this.score += 100;
        this.sfx.pickup();
        this.burst(g.x * TILE + 20, g.y * TILE + 20, '#7ee7ff', 14);
        this.showMessage(`Moon-gem ${this.gemsTaken}/${this.gemsTotal} pocketed (+100)`, 2.5);
        if (this.gemsTaken === this.gemsTotal) {
          this.exitOpen = true;
          this.sfx.unlock();
          this.showMessage('All gems pocketed — the exit is open. Go, unseen!', 4);
        }
        this.updateHud();
      }
    }

    // Exit.
    if (this.exitOpen) {
      const ex = this.exit.x * TILE + 20;
      const ey = this.exit.y * TILE + 20;
      if (Math.hypot(ex - this.player.x, ey - this.player.y) < 26) {
        this.onLevelClear();
        return;
      }
    }
  }

  onSpotted(guard) {
    this.sfx.alertSting();
    this.shake = 6;
    this.showMessage('SPOTTED! Break line of sight and hide!', 3);
    // Every other warden converges on the last seen position.
    for (const g of this.guards) {
      if (g !== guard && g.state !== GUARD_STATES.ALERT) {
        g.investigate = { x: this.player.x, y: this.player.y };
        g.state = GUARD_STATES.SUSPICIOUS;
        g.detection = Math.max(g.detection, 60);
      }
    }
  }

  onCameraTripped(cam) {
    this.sfx.alertSting();
    this.alertsThisLevel += 1;
    this.showMessage('Camera tripped! The wardens are coming!', 3);
    const nearest = this.guards.reduce((best, g) => {
      const d = Math.hypot(g.x - cam.x, g.y - cam.y);
      return !best || d < best.d ? { g, d } : best;
    }, null);
    if (nearest) {
      nearest.g.investigate = { x: this.player.x, y: this.player.y };
      nearest.g.state = GUARD_STATES.SUSPICIOUS;
      nearest.g.detection = Math.max(nearest.g.detection, 70);
    }
  }

  onCaught() {
    this.state = STATES.CAUGHT;
    this.sfx.caught();
    this.sfx.stopMusic();
    this.updateOverlays();
  }

  onLevelClear() {
    const timeBonus = Math.max(0, Math.round((LEVELS[this.levelIndex].par - this.levelTime) * 5));
    const ghostBonus = this.alertsThisLevel === 0 ? 500 : 0;
    const levelBonus = 250 + timeBonus + ghostBonus;
    this.score += levelBonus;
    this.sfx.levelClear();
    this.lastClear = {
      timeBonus,
      ghostBonus,
      levelBonus,
      level: LEVELS[this.levelIndex].name,
      time: this.levelTime,
    };
    this.state = STATES.LEVEL_CLEAR;
    this.updateOverlays();
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 70;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        size: 2 + Math.random() * 2.5,
        color,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.noiseEvents = this.noiseEvents.filter((e) => (e.life -= dt) > 0);
  }

  showMessage(text, seconds) {
    this.message = text;
    this.messageTimer = seconds;
    const el = document.getElementById('message');
    if (el) el.textContent = text;
  }

  formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  updateHud() {
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('hud-level', LEVELS[this.levelIndex].name);
    set('hud-gems', `◆ ${this.gemsTaken}/${this.gemsTotal}`);
    set('hud-coins', `● ${this.player.coins}`);
    set('hud-time', this.formatTime(this.levelTime));
    set('hud-score', `Score ${this.score}`);
    set('hud-objective', this.exitOpen
      ? 'Reach the green EXIT — unseen!'
      : `Pocket all ${this.gemsTotal} moon-gems, then reach the EXIT`);
    const alarm = document.getElementById('hud-alarm');
    if (alarm) {
      const anyAlert = this.guards.some((g) => g.state === GUARD_STATES.ALERT) ||
        this.cameras.some((c) => c.tripped);
      const anySusp = this.guards.some((g) => g.state === GUARD_STATES.SUSPICIOUS || g.state === GUARD_STATES.SEARCH);
      alarm.textContent = anyAlert ? '⚠ ALARM — THEY SEE YOU' : anySusp ? '? Suspicious…' : '✓ Unseen';
      alarm.className = anyAlert ? 'alarm alert' : anySusp ? 'alarm suspicious' : 'alarm calm';
    }
    const noise = document.getElementById('hud-noise');
    if (noise) {
      noise.textContent = this.player.stance === 'run' ? 'NOISE: LOUD — wardens can hear you'
        : this.player.stance === 'sneak' ? 'NOISE: silent'
        : 'NOISE: quiet';
    }
  }

  updateOverlays() {
    const show = (id, visible) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !visible);
    };
    show('overlay-title', this.state === STATES.TITLE);
    show('overlay-pause', this.state === STATES.PAUSED);
    show('overlay-caught', this.state === STATES.CAUGHT);
    show('overlay-clear', this.state === STATES.LEVEL_CLEAR);
    show('overlay-win', this.state === STATES.WON);
    if (this.state === STATES.LEVEL_CLEAR && this.lastClear) {
      const el = document.getElementById('clear-stats');
      if (el) {
        el.innerHTML =
          `<p>${this.lastClear.level} — cleared in ${this.formatTime(this.lastClear.time)}</p>` +
          `<p>Time bonus +${this.lastClear.timeBonus} · ` +
          (this.lastClear.ghostBonus ? `Ghost bonus +${this.lastClear.ghostBonus} (never spotted!) · ` : '') +
          `Level bonus +${this.lastClear.levelBonus}</p>` +
          `<p><strong>Total score: ${this.score}</strong></p>`;
      }
      const btn = document.getElementById('btn-next-level');
      if (btn) btn.textContent = this.levelIndex + 1 >= LEVELS.length ? 'See the haul' : 'Next level →';
    }
    if (this.state === STATES.WON) {
      const el = document.getElementById('win-stats');
      if (el) {
        el.innerHTML =
          `<p>You slipped out of the Marrowgate Museum with every moon-gem.</p>` +
          `<p>Final score: <strong>${this.score}</strong> · Total time: <strong>${this.formatTime(this.totalTime)}</strong></p>` +
          `<p>Three halls, ${this.gemsTotal + 7} gems, zero alarms left ringing — the Velvet Hour is yours.</p>`;
      }
    }
  }

  bindHudButtons() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('btn-start', () => this.startGame());
    on('btn-resume', () => { this.state = STATES.PLAYING; this.updateOverlays(); });
    on('btn-retry', () => this.retryLevel());
    on('btn-next-level', () => this.nextLevel());
    on('btn-play-again', () => this.startGame());
    on('btn-mute', () => {
      const muted = this.sfx.toggleMute();
      const el = document.getElementById('btn-mute');
      if (el) el.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
    });
  }

  // Staged scenes for screenshots: same code and renderer, frozen in place.
  applyShotMode(mode) {
    this.demoMode = mode;
    if (mode === 'title') {
      this.loadLevel(0);
      this.state = STATES.TITLE;
      this.updateOverlays();
      return;
    }
    if (mode === 'sneak') {
      this.loadLevel(0);
      this.state = STATES.PLAYING;
      // Wren crouched in the bush at (5,5) while a warden's cone sweeps past.
      this.player.x = 5 * TILE + 20;
      this.player.y = 5 * TILE + 20;
      this.player.stance = 'sneak';
      this.player.sneaking = true;
      const g = this.guards[0];
      g.x = 8 * TILE + 20;
      g.y = 2 * TILE + 20;
      g.facing = Math.PI * 0.72;
      g.detection = 58;
      g.state = GUARD_STATES.SUSPICIOUS;
      this.gems[0].taken = true;
      this.gemsTaken = 1;
      this.score = 100;
      this.levelTime = 47;
      this.showMessage('A warden is suspicious — hold still in the bush…', 60);
      this.updateHud();
      this.updateOverlays();
      return;
    }
    if (mode === 'alert') {
      this.loadLevel(1);
      this.state = STATES.PLAYING;
      // Wren two tiles from the exit, a warden in full chase, red cone.
      this.player.x = 20 * TILE + 20;
      this.player.y = 13 * TILE + 20;
      this.player.stance = 'run';
      const g = this.guards[1];
      g.x = 16 * TILE + 20;
      g.y = 10 * TILE + 20;
      g.facing = Math.atan2(this.player.y - g.y, this.player.x - g.x);
      g.detection = 100;
      g.state = GUARD_STATES.ALERT;
      this.alarmLevel = 1;
      this.gems.forEach((gem) => { gem.taken = true; });
      this.gemsTaken = this.gemsTotal;
      this.exitOpen = true;
      this.score = 640;
      this.levelTime = 83;
      this.showMessage('SPOTTED! Break line of sight and hide!', 60);
      this.updateHud();
      this.updateOverlays();
      return;
    }
    if (mode === 'win') {
      this.loadLevel(2);
      this.score = 2840;
      this.totalTime = 318;
      this.levelTime = 96;
      this.gems.forEach((gem) => { gem.taken = true; });
      this.gemsTaken = this.gemsTotal;
      this.state = STATES.WON;
      this.updateHud();
      this.updateOverlays();
    }
  }
}
