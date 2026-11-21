// Canvas rendering: the night museum — marble floor, crates and bushes for
// cover, glowing vision cones, and a pool of light around the burglar.
import { TILE, COLS, ROWS, tileAt } from './levels.js';

const W = COLS * TILE;
const H = ROWS * TILE;

function hashTile(tx, ty) {
  let h = (tx * 374761393 + ty * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw(state) {
    const ctx = this.ctx;
    const { grid, player, guards, cameras, gems, exit, exitOpen, time } = state;
    ctx.clearRect(0, 0, W, H);
    this.drawFloor(ctx, grid);
    this.drawExit(ctx, exit, exitOpen, time);
    this.drawGems(ctx, gems, time);
    this.drawCover(ctx, grid);
    this.drawPatrolDots(ctx, guards);
    this.drawCones(ctx, guards, cameras);
    this.drawCameras(ctx, cameras);
    this.drawGuards(ctx, guards, time);
    this.drawPlayer(ctx, player, state);
    this.drawParticles(ctx, state.particles);
    this.drawLighting(ctx, player, state.alarmLevel);
    this.drawVignette(ctx);
  }

  drawFloor(ctx, grid) {
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const x = tx * TILE;
        const y = ty * TILE;
        const h = hashTile(tx, ty);
        const ch = grid[ty][tx];
        if (ch === '#') {
          ctx.fillStyle = '#232733';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#2e3342';
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = '#1a1d27';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        } else {
          const base = (tx + ty) % 2 === 0 ? 34 : 30;
          const v = base + Math.floor(h * 6);
          ctx.fillStyle = `rgb(${v + 6},${v + 4},${v + 12})`;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          if (h > 0.86) {
            ctx.fillStyle = 'rgba(212,175,105,0.10)';
            ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
          }
        }
      }
    }
  }

  drawExit(ctx, exit, exitOpen, time) {
    const cx = exit.x * TILE + TILE / 2;
    const cy = exit.y * TILE + TILE / 2;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = exitOpen ? '#0d3b26' : '#2a2f3a';
    ctx.strokeStyle = exitOpen ? `rgba(64,224,140,${0.55 + 0.45 * pulse})` : '#565d6e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-17, -17, 34, 34, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = exitOpen ? '#46e08c' : '#8a93a6';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(exitOpen ? 'EXIT' : 'LOCK', 0, exitOpen ? -1 : 0);
    if (exitOpen) {
      ctx.strokeStyle = `rgba(70,224,140,${0.35 + 0.3 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-22, -22, 44, 44, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGems(ctx, gems, time) {
    for (const g of gems) {
      if (g.taken) continue;
      const cx = g.x * TILE + TILE / 2;
      const cy = g.y * TILE + TILE / 2 + Math.sin(time * 2 + g.x) * 2;
      const glow = 0.4 + 0.3 * Math.sin(time * 3 + g.y);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = `rgba(94,225,255,${glow})`;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7ee7ff';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(8, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8fbff';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawCover(ctx, grid) {
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const ch = grid[ty][tx];
        const x = tx * TILE;
        const y = ty * TILE;
        if (ch === 'C') {
          ctx.fillStyle = '#5d4423';
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = '#7a5a30';
          ctx.fillRect(x + 3, y + 3, TILE - 6, 8);
          ctx.strokeStyle = '#3d2c15';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + TILE - 3, y + TILE - 3);
          ctx.moveTo(x + TILE - 3, y + 3);
          ctx.lineTo(x + 3, y + TILE - 3);
          ctx.stroke();
        } else if (ch === 'B') {
          const h = hashTile(tx, ty);
          ctx.fillStyle = 'rgba(20,52,28,0.9)';
          ctx.beginPath();
          ctx.arc(x + 12 + h * 8, y + 14, 11, 0, Math.PI * 2);
          ctx.arc(x + 26, y + 12 + h * 6, 12, 0, Math.PI * 2);
          ctx.arc(x + 20, y + 27, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(52,120,64,0.85)';
          ctx.beginPath();
          ctx.arc(x + 14 + h * 6, y + 12, 6, 0, Math.PI * 2);
          ctx.arc(x + 26, y + 15 + h * 5, 6, 0, Math.PI * 2);
          ctx.arc(x + 19, y + 25, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawPatrolDots(ctx, guards) {
    ctx.fillStyle = 'rgba(255,214,120,0.28)';
    for (const g of guards) {
      for (const p of g.path) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  conePath(ctx, x, y, facing, halfAngle, range) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
    ctx.closePath();
  }

  drawCones(ctx, guards, cameras) {
    for (const cam of cameras) {
      const grad = ctx.createRadialGradient(cam.x, cam.y, 8, cam.x, cam.y, cam.range);
      const col = cam.tripped ? '255,70,70' : '255,90,90';
      grad.addColorStop(0, `rgba(${col},0.34)`);
      grad.addColorStop(1, `rgba(${col},0.02)`);
      ctx.fillStyle = grad;
      this.conePath(ctx, cam.x, cam.y, cam.facing, 0.5, cam.range);
      ctx.fill();
    }
    for (const g of guards) {
      const alert = g.state === 'alert';
      const susp = g.state === 'suspicious' || g.state === 'search';
      const col = alert ? '255,64,64' : susp ? '255,190,80' : '255,214,120';
      const alpha = alert ? 0.42 : susp ? 0.36 : 0.28;
      const grad = ctx.createRadialGradient(g.x, g.y, 10, g.x, g.y, 210);
      grad.addColorStop(0, `rgba(${col},${alpha})`);
      grad.addColorStop(1, `rgba(${col},0.02)`);
      ctx.fillStyle = grad;
      this.conePath(ctx, g.x, g.y, g.facing, 0.61, 210);
      ctx.fill();
      ctx.strokeStyle = `rgba(${col},0.5)`;
      ctx.lineWidth = 1.5;
      this.conePath(ctx, g.x, g.y, g.facing, 0.61, 210);
      ctx.stroke();
    }
  }

  drawCameras(ctx, cameras) {
    for (const cam of cameras) {
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.fillStyle = '#3a3f4d';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cam.tripped ? '#ff4444' : '#ff5a5a';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(cam.facing);
      ctx.fillStyle = '#565d6e';
      ctx.fillRect(4, -3, 12, 6);
      ctx.restore();
      if (cam.detection > 2) {
        ctx.fillStyle = '#ff5a5a';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`CAM ${Math.round(cam.detection)}%`, cam.x, cam.y - 16);
      }
    }
  }

  drawGuards(ctx, guards, time) {
    for (const g of guards) {
      const alert = g.state === 'alert';
      const susp = g.state === 'suspicious' || g.state === 'search';
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(g.x, g.y + 11, 13, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // body
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.fillStyle = alert ? '#7a1f2b' : '#2b3a67';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = alert ? '#ff6b6b' : '#d4af69';
      ctx.lineWidth = 2;
      ctx.stroke();
      // facing wedge / helmet lamp
      ctx.rotate(g.facing);
      ctx.fillStyle = alert ? '#ff8a8a' : '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(4, -6);
      ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // eyes
      const ex = Math.cos(g.facing) * 5;
      const ey = Math.sin(g.facing) * 5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(g.x + ex - 3, g.y + ey - 3, 1.8, 0, Math.PI * 2);
      ctx.arc(g.x + ex + 3, g.y + ey + 3, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // state mark
      if (alert || susp) {
        const bob = Math.sin(time * 5) * 2;
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = alert ? '#ff5555' : '#ffb84d';
        ctx.fillText(alert ? '!' : '?', g.x, g.y - 20 + bob);
      }
      // detection arc
      if (g.detection > 2 && g.detection < 100) {
        ctx.strokeStyle = g.detection >= 45 ? '#ffb84d' : '#ffe9a8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 18, -Math.PI / 2, -Math.PI / 2 + (g.detection / 100) * Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawPlayer(ctx, player, state) {
    const p = player;
    // noise ring while running
    if (p.stance === 'run' && p.moving) {
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 8);
      ctx.strokeStyle = `rgba(255,120,90,${0.25 + 0.25 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.noiseRadius * (0.55 + 0.25 * pulse), 0, Math.PI * 2);
      ctx.stroke();
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 11, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // cloak
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    ctx.fillStyle = p.hiddenInBush ? '#2e7d5b' : '#1f9d8a';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-9, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f5f52';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8fff9';
    ctx.beginPath();
    ctx.arc(4, -3, 1.6, 0, Math.PI * 2);
    ctx.arc(4, 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // coin in flight
    const coin = p.coinPosition();
    if (coin) {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // sneak hint
    if (p.sneaking) {
      ctx.fillStyle = 'rgba(232,255,249,0.85)';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SNEAKING', p.x, p.y - 20);
    }
  }

  drawParticles(ctx, particles) {
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawLighting(ctx, player, alarmLevel) {
    // A pool of light follows the burglar; the rest of the hall stays dim.
    const grad = ctx.createRadialGradient(player.x, player.y, 40, player.x, player.y, 260);
    grad.addColorStop(0, 'rgba(4,6,14,0)');
    grad.addColorStop(1, `rgba(4,6,14,${alarmLevel > 0.4 ? 0.42 : 0.55})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  drawVignette(ctx) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.85);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}
