// render.js — everything the eye sees: the moonlit floor, the bookcases,
// the guards' vision cones, the player, and the HUD and title screens.
// All drawing is plain Canvas 2D, no images, no fonts to load.

import {
  COLS,
  ROWS,
  TILE,
  HUD_H,
  LEVEL_W,
  LEVEL_H,
  T_FLOOR,
  T_WALL,
  T_SHELF,
  T_CRATE,
  T_SHADOW,
  GUARD_VIEW_HALF_ANGLE,
  DOCUMENT_COUNT,
} from './config.js';
import { viewRangeFor } from './guards.js';

const FLOOR_A = '#252c40';
const FLOOR_B = '#222839';
const MOON = 'rgba(150, 180, 235, 0.10)';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFloor(ctx, level, time) {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const t = level.get(tx, ty);
      const x = tx * TILE;
      const y = HUD_H + ty * TILE;
      if (t === T_WALL) continue;
      ctx.fillStyle = (tx + ty) % 2 === 0 ? FLOOR_A : FLOOR_B;
      ctx.fillRect(x, y, TILE, TILE);
      if (t === T_SHADOW) {
        ctx.fillStyle = 'rgba(4, 6, 16, 0.5)';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
  // Moonlight pools through the high windows, drifting slowly.
  const pools = [
    [300, 150, 260],
    [900, 420, 300],
    [620, 620, 220],
  ];
  for (const [px, py, pr] of pools) {
    const cx = px + Math.sin(time * 0.11) * 12;
    const cy = HUD_H + py + Math.cos(time * 0.09) * 10;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, pr);
    g.addColorStop(0, MOON);
    g.addColorStop(1, 'rgba(150, 180, 235, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - pr, cy - pr, pr * 2, pr * 2);
  }
  // Dust and scuffs on the floorboards.
  for (const d of level.dust) {
    ctx.fillStyle = `rgba(200, 210, 240, ${d.a})`;
    ctx.fillRect(d.x, HUD_H + d.y, d.r, d.r);
  }
}

function drawStructures(ctx, level) {
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const t = level.get(tx, ty);
      const x = tx * TILE;
      const y = HUD_H + ty * TILE;
      if (t === T_WALL) {
        ctx.fillStyle = '#3d4258';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#565d7d';
        ctx.fillRect(x, y, TILE, 4);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
      } else if (t === T_SHELF) {
        ctx.fillStyle = '#4a3220';
        ctx.fillRect(x + 1, y + 2, TILE - 2, TILE - 4);
        // Book spines: a row of thin coloured ticks.
        const spineColors = ['#7a4a2b', '#5d6b3a', '#31465e', '#6b2f3a', '#8a6d2f'];
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = spineColors[(tx * 3 + ty * 5 + i) % spineColors.length];
          ctx.fillRect(x + 3 + i * 3.5, y + 6, 2.5, TILE - 12);
        }
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(x + 1, y + TILE - 4, TILE - 2, 2);
      } else if (t === T_CRATE) {
        ctx.fillStyle = '#5a4632';
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = '#3a2d1e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 3, y + 3);
        ctx.lineTo(x + TILE - 3, y + TILE - 3);
        ctx.moveTo(x + TILE - 3, y + 3);
        ctx.lineTo(x + 3, y + TILE - 3);
        ctx.stroke();
      }
    }
  }
}

function drawDocuments(ctx, level, time) {
  for (const doc of level.documents) {
    if (doc.taken) continue;
    const bob = Math.sin(time * 2 + doc.bobPhase) * 2;
    const x = doc.x;
    const y = HUD_H + doc.y + bob;
    const glow = ctx.createRadialGradient(x, y, 2, x, y, 34);
    glow.addColorStop(0, 'rgba(255, 214, 120, 0.5)');
    glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 34, y - 34, 68, 68);
    // A sealed parchment: cream sheet, red wax seal, ribbon.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(-9, -12, 18, 24);
    ctx.strokeStyle = '#b09a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(-9, -12, 18, 24);
    ctx.fillStyle = '#8a2f2f';
    ctx.beginPath();
    ctx.arc(0, 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawExit(ctx, level, time) {
  const ex = level.exit;
  const x = ex.x;
  const y = HUD_H + ex.y;
  const open = ex.open;
  const pulse = open ? 0.65 + Math.sin(time * 3) * 0.25 : 0.25;
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 60);
  glow.addColorStop(0, `rgba(90, 230, 140, ${pulse})`);
  glow.addColorStop(1, 'rgba(90, 230, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 60, y - 60, 120, 120);
  // The green door on the east wall.
  ctx.fillStyle = open ? '#2fae5f' : '#2a4a35';
  ctx.fillRect(x + 8, y - 16, 8, 32);
  ctx.fillStyle = open ? '#7de8a4' : '#4a7a5c';
  ctx.fillRect(x + 8, y - 16, 3, 32);
  ctx.fillStyle = '#d8ffe8';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'EXIT OPEN' : 'EXIT', x - 14, y - 20);
  if (open) {
    ctx.fillStyle = '#7de8a4';
    ctx.beginPath();
    ctx.moveTo(x - 30, y - 6);
    ctx.lineTo(x - 18, y);
    ctx.lineTo(x - 30, y + 6);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCoin(ctx, coin) {
  if (!coin) return;
  const y = HUD_H + coin.y;
  ctx.fillStyle = '#e8c85a';
  ctx.beginPath();
  ctx.arc(coin.x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a6d2f';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (coin.pingTimer > 0) {
    const p = 1 - coin.pingTimer / 1.4;
    ctx.strokeStyle = `rgba(232, 200, 90, ${0.8 * (1 - p)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(coin.x, y, 8 + p * 46, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCone(ctx, guard, player, level) {
  const range = viewRangeFor(guard, player, level);
  const cx = guard.x;
  const cy = HUD_H + guard.y;
  // The cone must read at a glance, even shrunk: a strong fill that fades
  // only a little toward the rim, in the guard's current mood.
  const base =
    guard.state === 'chase'
      ? [232, 70, 70]
      : guard.state === 'suspicious' || guard.state === 'investigate'
        ? [232, 150, 60]
        : [232, 196, 90];
  const grad = ctx.createRadialGradient(cx, cy, 8, cx, cy, range);
  grad.addColorStop(0, `rgba(${base[0]}, ${base[1]}, ${base[2]}, 0.42)`);
  grad.addColorStop(0.7, `rgba(${base[0]}, ${base[1]}, ${base[2]}, 0.30)`);
  grad.addColorStop(1, `rgba(${base[0]}, ${base[1]}, ${base[2]}, 0.16)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, range, guard.angle - GUARD_VIEW_HALF_ANGLE, guard.angle + GUARD_VIEW_HALF_ANGLE);
  ctx.closePath();
  ctx.fill();
  // Bright edge lines so the cone's reach is unmistakable.
  ctx.strokeStyle = `rgba(${base[0]}, ${base[1]}, ${base[2]}, 0.75)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(guard.angle - GUARD_VIEW_HALF_ANGLE) * range, cy + Math.sin(guard.angle - GUARD_VIEW_HALF_ANGLE) * range);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(guard.angle + GUARD_VIEW_HALF_ANGLE) * range, cy + Math.sin(guard.angle + GUARD_VIEW_HALF_ANGLE) * range);
  ctx.stroke();
  // A faint arc at the cone's far edge.
  ctx.strokeStyle = `rgba(${base[0]}, ${base[1]}, ${base[2]}, 0.4)`;
  ctx.beginPath();
  ctx.arc(cx, cy, range, guard.angle - GUARD_VIEW_HALF_ANGLE, guard.angle + GUARD_VIEW_HALF_ANGLE);
  ctx.stroke();
}

function drawGuard(ctx, guard, time) {
  const x = guard.x;
  const y = HUD_H + guard.y;
  // Lantern glow around the guard.
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 44);
  glow.addColorStop(0, 'rgba(255, 200, 110, 0.22)');
  glow.addColorStop(1, 'rgba(255, 200, 110, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 44, y - 44, 88, 88);
  // Body: a dark uniform with a coloured sash.
  ctx.fillStyle = '#2c3247';
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = guard.color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Facing tick.
  ctx.strokeStyle = guard.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(guard.angle) * 16, y + Math.sin(guard.angle) * 16);
  ctx.stroke();
  // Lantern dot.
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(x + Math.cos(guard.angle) * 16, y + Math.sin(guard.angle) * 16, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Alert marker: ? when suspicious, ! when chasing, ... when searching.
  const mark =
    guard.state === 'chase' ? '!' : guard.state === 'suspicious' ? '?' : guard.state === 'search' || guard.state === 'investigate' ? '…' : null;
  if (mark) {
    ctx.fillStyle = guard.state === 'chase' ? '#ff5a5a' : '#ffd24a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(mark, x, y - 20 + Math.sin(time * 4) * 1.5);
  }
  // Alert ring while the guard is on edge.
  if (guard.alert > 5) {
    ctx.strokeStyle = `rgba(255, ${guard.alert > 60 ? 90 : 190}, 60, 0.8)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 16, -Math.PI / 2, -Math.PI / 2 + (guard.alert / 100) * Math.PI * 2);
    ctx.stroke();
  }
  // Name tag, small, so the watch feels like people.
  ctx.fillStyle = 'rgba(220, 225, 245, 0.75)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(guard.name.split(' ')[1] ?? guard.name, x, y + 26);
}

function drawPlayer(ctx, player, time) {
  const bob = player.moving ? Math.sin(player.stepPhase * 2) * 1.2 : Math.sin(time * 1.5) * 0.6;
  const x = player.x;
  const y = HUD_H + player.y + bob;
  // A soft shadow under the feet.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(x, HUD_H + player.y + 10, 11, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hooded cloak: cream when walking, dimmed when sneaking.
  ctx.fillStyle = player.sneaking ? '#8f8871' : '#ddd5bd';
  ctx.beginPath();
  ctx.arc(x, y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a5344';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Hood point toward the facing direction.
  ctx.fillStyle = '#b8ad8f';
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(player.angle) * 13, y + Math.sin(player.angle) * 13);
  ctx.lineTo(
    x + Math.cos(player.angle + 2.5) * 9,
    y + Math.sin(player.angle + 2.5) * 9,
  );
  ctx.lineTo(
    x + Math.cos(player.angle - 2.5) * 9,
    y + Math.sin(player.angle - 2.5) * 9,
  );
  ctx.closePath();
  ctx.fill();
  // Satchel strap.
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 6);
  ctx.lineTo(x + 7, y + 6);
  ctx.stroke();
  // Sneak indicator: a small "shh" eye-line when hidden in shadow.
  if (player.sneaking) {
    ctx.fillStyle = 'rgba(220, 225, 245, 0.8)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('sneaking', x, y - 18);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function drawHud(ctx, game) {
  ctx.fillStyle = '#12141f';
  ctx.fillRect(0, 0, LEVEL_W, HUD_H);
  ctx.fillStyle = '#2c3247';
  ctx.fillRect(0, HUD_H - 1, LEVEL_W, 1);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#d8c98a';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('NIGHT SHIFT AT THE ARCHIVE', 12, HUD_H / 2 + 1);

  // Documents.
  ctx.fillStyle = '#e8dcc0';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  let dx = 330;
  for (let i = 0; i < DOCUMENT_COUNT; i++) {
    ctx.globalAlpha = i < game.player.documents ? 1 : 0.35;
    ctx.fillText('▣', dx, HUD_H / 2 + 1);
    dx += 18;
  }
  ctx.globalAlpha = 1;
  ctx.fillText(`${game.player.documents}/${DOCUMENT_COUNT} documents`, dx + 4, HUD_H / 2 + 1);

  // Alert meter: the highest alert among the watch.
  const topAlert = Math.max(0, ...game.guards.map((g) => g.alert));
  const ax = 620;
  ctx.fillStyle = '#3a3f52';
  ctx.fillRect(ax, 10, 150, 12);
  ctx.fillStyle = topAlert >= 100 ? '#e84a4a' : topAlert >= 40 ? '#e8963c' : '#e8c85a';
  ctx.fillRect(ax, 10, (150 * topAlert) / 100, 12);
  ctx.strokeStyle = '#565d7d';
  ctx.lineWidth = 1;
  ctx.strokeRect(ax, 10, 150, 12);
  ctx.fillStyle = '#dfe3f2';
  ctx.font = '12px sans-serif';
  ctx.fillText(topAlert >= 100 ? 'SPOTTED!' : topAlert >= 40 ? 'Suspicious' : 'Unseen', ax + 158, HUD_H / 2 + 1);

  // Coins.
  ctx.fillStyle = '#e8c85a';
  ctx.font = '13px sans-serif';
  ctx.fillText(`● ${game.player.coins} coins`, 950, HUD_H / 2 + 1);

  // Timer.
  ctx.fillStyle = '#dfe3f2';
  ctx.textAlign = 'right';
  ctx.fillText(formatTime(game.elapsed), LEVEL_W - 12, HUD_H / 2 + 1);
  ctx.textAlign = 'left';
}

function drawOverlay(ctx, title, lines, accent, footer) {
  ctx.fillStyle = 'rgba(8, 10, 20, 0.78)';
  ctx.fillRect(0, 0, LEVEL_W, HUD_H + LEVEL_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText(title, LEVEL_W / 2, 240);
  ctx.fillStyle = '#dfe3f2';
  ctx.font = '16px Georgia, serif';
  let y = 300;
  for (const line of lines) {
    ctx.fillText(line, LEVEL_W / 2, y);
    y += 28;
  }
  if (footer) {
    ctx.fillStyle = '#e8c85a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(footer, LEVEL_W / 2, y + 30);
  }
}

export function render(ctx, game) {
  const time = game.time;
  ctx.clearRect(0, 0, LEVEL_W, HUD_H + LEVEL_H);
  ctx.fillStyle = '#12141f';
  ctx.fillRect(0, 0, LEVEL_W, HUD_H + LEVEL_H);

  drawFloor(ctx, game.level, time);
  drawDocuments(ctx, game.level, time);
  drawExit(ctx, game.level, time);
  drawCoin(ctx, game.coin);
  for (const guard of game.guards) drawCone(ctx, guard, game.player, game.level);
  for (const guard of game.guards) drawGuard(ctx, guard, time);
  if (game.state !== 'title') drawPlayer(ctx, game.player, time);
  drawStructures(ctx, game.level);
  drawHud(ctx, game);

  // Moonlit vignette over everything.
  const vg = ctx.createRadialGradient(
    LEVEL_W / 2,
    (HUD_H + LEVEL_H) / 2,
    LEVEL_H * 0.45,
    LEVEL_W / 2,
    (HUD_H + LEVEL_H) / 2,
    LEVEL_H * 0.95,
  );
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, HUD_H, LEVEL_W, LEVEL_H);

  if (game.state === 'title') {
    drawOverlay(
      ctx,
      'NIGHT SHIFT AT THE ARCHIVE',
      [
        'The archive closes at midnight. Three sealed documents are inside,',
        'and five guards walk the stacks by lantern light. Take the documents,',
        'reach the green door, and leave no trace you were ever here.',
        '',
        'WASD / arrows — move        Shift — sneak (slow, quiet, hard to see)',
        'E or click — toss a coin to distract a guard        P — pause',
        'Hide in the dark pools. Break line of sight to shake a chase.',
      ],
      '#e8c85a',
      'Press ENTER to begin the night',
    );
  } else if (game.state === 'paused') {
    drawOverlay(ctx, 'PAUSED', ['The archive waits. The guards keep walking.'], '#dfe3f2', 'Press P to return');
  } else if (game.state === 'caught') {
    drawOverlay(
      ctx,
      'CAUGHT!',
      [
        `${game.caughtBy ?? 'A guard'} caught you in the lamplight.`,
        `Documents found: ${game.player.documents} of ${DOCUMENT_COUNT}    Time: ${formatTime(game.elapsed)}`,
      ],
      '#ff6a5a',
      'Press R to try again',
    );
  } else if (game.state === 'won') {
    const rank = game.player.alertsTriggered === 0 ? 'GHOST — never once spotted' : game.player.alertsTriggered <= 2 ? 'SHADOW — barely a whisper' : 'LOUD — but out the door';
    drawOverlay(
      ctx,
      'CLEAN GETAWAY',
      [
        `All three documents are yours. The green door closes behind you.`,
        `Time: ${formatTime(game.elapsed)}    Times spotted: ${game.player.alertsTriggered}    Coins used: ${game.player.coinsUsed}`,
        rank,
      ],
      '#7de8a4',
      'Press R to work another night',
    );
  }

  // Objective hint line while playing.
  if (game.state === 'playing') {
    ctx.fillStyle = 'rgba(223, 227, 242, 0.85)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    const hint =
      game.player.documents < DOCUMENT_COUNT
        ? `Find the sealed documents — ${game.player.documents}/${DOCUMENT_COUNT} found`
        : 'All documents found — reach the green EXIT door!';
    ctx.fillText(hint, 12, HUD_H + LEVEL_H - 10);
  }
}
