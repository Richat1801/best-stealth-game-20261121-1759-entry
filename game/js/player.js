// Wren, the cat burglar: movement, stance (walk / sneak / run), noise and
// the coin toss that pulls a warden off its patrol.
import { TILE, tileAt, isSolidTile } from './levels.js';

export const STANCES = { WALK: 'walk', SNEAK: 'sneak', RUN: 'run' };

const SPEEDS = { walk: 108, sneak: 62, run: 168 };
const NOISE_RADIUS = { walk: 26, sneak: 0, run: 150 };

export class Player {
  constructor(start) {
    this.x = start.x * TILE + TILE / 2;
    this.y = start.y * TILE + TILE / 2;
    this.radius = 11;
    this.facing = -Math.PI / 2;
    this.stance = STANCES.WALK;
    this.moving = false;
    this.coins = 3;
    this.coinFlight = null; // {x0,y0,x1,y1,t} while a coin is in the air
    this.stepPhase = 0;
    this.hiddenInBush = false;
    this.sneaking = false;
  }

  get speed() {
    return SPEEDS[this.stance];
  }

  get noiseRadius() {
    return NOISE_RADIUS[this.stance];
  }

  update(dt, keys, grid) {
    let dx = 0;
    let dy = 0;
    if (keys['arrowup'] || keys['w']) dy -= 1;
    if (keys['arrowdown'] || keys['s']) dy += 1;
    if (keys['arrowleft'] || keys['a']) dx -= 1;
    if (keys['arrowright'] || keys['d']) dx += 1;
    this.moving = dx !== 0 || dy !== 0;

    const wantRun = keys['shift'];
    const wantSneak = keys['control'] || keys['c'];
    this.stance = wantSneak ? STANCES.SNEAK : wantRun ? STANCES.RUN : STANCES.WALK;
    this.sneaking = this.stance === STANCES.SNEAK;

    if (this.moving) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.facing = Math.atan2(dy, dx);
      const inBush = tileAt(grid, Math.floor(this.x / TILE), Math.floor(this.y / TILE)) === 'B';
      const speed = this.speed * (inBush ? 0.55 : 1);
      const step = speed * dt;
      const nx = this.x + dx * step;
      const ny = this.y + dy * step;
      if (!this.collides(nx, this.y, grid)) this.x = nx;
      if (!this.collides(this.x, ny, grid)) this.y = ny;
      this.stepPhase += step;
    }

    this.hiddenInBush = tileAt(grid, Math.floor(this.x / TILE), Math.floor(this.y / TILE)) === 'B';

    if (this.coinFlight) {
      this.coinFlight.t += dt / 0.45;
      if (this.coinFlight.t >= 1) {
        const landed = { x: this.coinFlight.x1, y: this.coinFlight.y1 };
        this.coinFlight = null;
        return { coinLanded: landed };
      }
    }
    return null;
  }

  throwCoin(tx, ty) {
    if (this.coins <= 0 || this.coinFlight) return false;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 280) return false;
    this.coins -= 1;
    this.coinFlight = { x0: this.x, y0: this.y, x1: tx, y1: ty, t: 0 };
    return true;
  }

  coinPosition() {
    if (!this.coinFlight) return null;
    const c = this.coinFlight;
    const t = Math.min(1, c.t);
    return {
      x: c.x0 + (c.x1 - c.x0) * t,
      y: c.y0 + (c.y1 - c.y0) * t - Math.sin(t * Math.PI) * 26,
    };
  }

  collides(px, py, grid) {
    const r = this.radius;
    const x0 = Math.floor((px - r) / TILE);
    const x1 = Math.floor((px + r) / TILE);
    const y0 = Math.floor((py - r) / TILE);
    const y1 = Math.floor((py + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (isSolidTile(tileAt(grid, tx, ty))) {
          const bx = tx * TILE;
          const by = ty * TILE;
          const cx = Math.max(bx, Math.min(px, bx + TILE));
          const cy = Math.max(by, Math.min(py, by + TILE));
          if (Math.hypot(px - cx, py - cy) < r) return true;
        }
      }
    }
    return false;
  }
}
