// Night wardens and security cameras: patrol routes, vision cones, hearing,
// suspicion and alert states. A warden never knows where you are until it
// sees or hears you — and it can lose you again if you break line of sight.
import { TILE, tileAt, blocksSightTile } from './levels.js';

export const GUARD_STATES = {
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  ALERT: 'alert',
  SEARCH: 'search',
};

const VISION_RANGE = 210;
const VISION_HALF_ANGLE = 0.61; // ~35 degrees each side
const CLOSE_RANGE = 42; // a warden spots you up close even in a bush

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Bresenham line-of-sight across tiles: walls, crates and bushes block sight.
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  let tx0 = Math.floor(x0 / TILE);
  let ty0 = Math.floor(y0 / TILE);
  const tx1 = Math.floor(x1 / TILE);
  const ty1 = Math.floor(y1 / TILE);
  const dx = Math.abs(tx1 - tx0);
  const dy = Math.abs(ty1 - ty0);
  const sx = tx0 < tx1 ? 1 : -1;
  const sy = ty0 < ty1 ? 1 : -1;
  let err = dx - dy;
  let guard = 0;
  for (;;) {
    if (guard++ > 200) return false;
    if (!(tx0 === Math.floor(x0 / TILE) && ty0 === Math.floor(y0 / TILE)) &&
        !(tx0 === tx1 && ty0 === ty1)) {
      if (blocksSightTile(tileAt(grid, tx0, ty0))) return false;
    }
    if (tx0 === tx1 && ty0 === ty1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; tx0 += sx; }
    if (e2 < dx) { err += dx; ty0 += sy; }
  }
}

export class Guard {
  constructor(def) {
    this.path = def.path.map(([tx, ty]) => ({
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
    }));
    this.speed = def.speed;
    this.pauseTime = def.pause || 1;
    this.x = this.path[0].x;
    this.y = this.path[0].y;
    this.waypoint = 1 % this.path.length;
    this.facing = 0;
    this.state = GUARD_STATES.PATROL;
    this.detection = 0; // 0..100, 100 = spotted
    this.pauseLeft = 0;
    this.investigate = null; // {x, y} point to walk to and look around
    this.searchLeft = 0;
    this.lookTimer = 0;
    this.lookAngle = 0;
    this.seenAt = null; // last seen player position
    this.loseTimer = 0;
    this.stepPhase = 0;
  }

  center() {
    return { x: this.x, y: this.y };
  }

  // How well this warden can see the player right now, 0..1.
  visibilityOf(player, grid) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > VISION_RANGE) return 0;
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(toPlayer, this.facing)) > VISION_HALF_ANGLE) return 0;
    if (!hasLineOfSight(grid, this.x, this.y, player.x, player.y)) return 0;
    if (player.hiddenInBush && dist > CLOSE_RANGE) return 0;
    // Closer and more exposed = seen faster; sneaking halves the rate.
    const closeness = 1 - dist / VISION_RANGE;
    let v = 0.35 + 0.65 * closeness;
    if (player.sneaking) v *= 0.55;
    if (dist < CLOSE_RANGE) v = 1;
    return v;
  }

  hearNoise(nx, ny, radius) {
    if (this.state === GUARD_STATES.ALERT) return;
    const d = Math.hypot(nx - this.x, ny - this.y);
    if (d <= radius) {
      this.investigate = { x: nx, y: ny };
      if (this.state === GUARD_STATES.PATROL) this.state = GUARD_STATES.SUSPICIOUS;
      this.detection = Math.max(this.detection, 45);
    }
  }

  update(dt, player, grid, onSpotted) {
    const vis = this.visibilityOf(player, grid);
    if (vis > 0) {
      this.detection += vis * 62 * dt;
      this.seenAt = { x: player.x, y: player.y };
      this.loseTimer = 0;
      if (this.detection >= 100) {
        this.detection = 100;
        if (this.state !== GUARD_STATES.ALERT) {
          this.state = GUARD_STATES.ALERT;
          onSpotted(this);
        }
      } else if (this.detection >= 45 && this.state === GUARD_STATES.PATROL) {
        this.state = GUARD_STATES.SUSPICIOUS;
      }
    } else {
      this.detection = Math.max(0, this.detection - 26 * dt);
      if (this.state === GUARD_STATES.SUSPICIOUS && this.detection < 20) {
        this.state = GUARD_STATES.SEARCH;
        this.searchLeft = 3;
      }
    }

    if (this.state === GUARD_STATES.ALERT) {
      if (vis > 0) {
        this.chase(dt, player.x, player.y, grid);
      } else {
        this.loseTimer += dt;
        if (this.loseTimer > 5) {
          this.state = GUARD_STATES.SEARCH;
          this.searchLeft = 4;
          this.investigate = this.seenAt;
        } else if (this.seenAt) {
          this.chase(dt, this.seenAt.x, this.seenAt.y, grid);
        }
      }
      return;
    }

    if (this.state === GUARD_STATES.SUSPICIOUS && this.investigate) {
      if (this.walkTo(dt, this.investigate.x, this.investigate.y, 88, grid)) {
        this.state = GUARD_STATES.SEARCH;
        this.searchLeft = 3;
        this.lookTimer = 0;
      }
      return;
    }

    if (this.state === GUARD_STATES.SEARCH) {
      this.searchLeft -= dt;
      this.lookTimer += dt;
      // Look around: sweep the facing back and forth while searching.
      this.facing = this.lookAngle + Math.sin(this.lookTimer * 1.6) * 1.1;
      if (this.searchLeft <= 0) {
        this.state = GUARD_STATES.PATROL;
        this.investigate = null;
        this.lookAngle = this.facing;
      }
      return;
    }

    // Patrol: walk the waypoints, pausing at each to look around.
    if (this.pauseLeft > 0) {
      this.pauseLeft -= dt;
      this.facing = this.lookAngle + Math.sin(this.pauseLeft * 2.2) * 0.5;
      return;
    }
    const target = this.path[this.waypoint];
    if (this.walkTo(dt, target.x, target.y, this.speed, grid)) {
      this.waypoint = (this.waypoint + 1) % this.path.length;
      this.pauseLeft = this.pauseTime;
      this.lookAngle = this.facing;
    }
  }

  // Walk toward a point; returns true when arrived. Sets facing.
  walkTo(dt, tx, ty, speed, grid) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) return true;
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    if (!this.collides(nx, this.y, grid)) this.x = nx;
    if (!this.collides(this.x, ny, grid)) this.y = ny;
    this.facing = Math.atan2(dy, dx);
    this.stepPhase += step;
    return false;
  }

  chase(dt, tx, ty, grid) {
    this.walkTo(dt, tx, ty, 132, grid);
  }

  collides(px, py, grid) {
    const r = 12;
    const x0 = Math.floor((px - r) / TILE);
    const x1 = Math.floor((px + r) / TILE);
    const y0 = Math.floor((py - r) / TILE);
    const y1 = Math.floor((py + r) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = tileAt(grid, tx, ty);
        if (ch === '#' || ch === 'C') {
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

export class Camera {
  constructor(def) {
    this.x = def.tx * TILE + TILE / 2;
    this.y = def.ty * TILE + TILE / 2;
    this.base = def.base;
    this.sweep = def.sweep;
    this.speed = def.speed;
    this.range = def.range;
    this.phase = Math.random() * Math.PI * 2;
    this.facing = def.base;
    this.detection = 0;
    this.tripped = false;
  }

  update(dt, player, grid, onSpotted) {
    this.phase += dt * this.speed;
    this.facing = this.base + Math.sin(this.phase) * this.sweep;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    let vis = 0;
    if (dist <= this.range) {
      const toPlayer = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(toPlayer, this.facing)) <= 0.5 &&
          hasLineOfSight(grid, this.x, this.y, player.x, player.y) &&
          !(player.hiddenInBush && dist > CLOSE_RANGE)) {
        vis = 0.5 + 0.5 * (1 - dist / this.range);
      }
    }
    if (vis > 0) {
      this.detection += vis * 85 * dt;
      if (this.detection >= 100 && !this.tripped) {
        this.detection = 100;
        this.tripped = true;
        onSpotted(this);
      }
    } else {
      this.detection = Math.max(0, this.detection - 40 * dt);
      if (this.detection < 60) this.tripped = false;
    }
  }
}
