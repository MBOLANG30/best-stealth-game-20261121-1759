// player.js — the night-shift archivist: a hooded figure with a satchel,
// three coins, and a habit of borrowing documents that were never meant
// to leave the vault. Walks, sneaks, tosses coins, picks things up.

import {
  PLAYER_RADIUS,
  PLAYER_WALK_SPEED,
  PLAYER_SNEAK_SPEED,
  COIN_COUNT,
  COIN_RANGE,
} from './config.js';
import { moveCircle } from './level.js';

export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    radius: PLAYER_RADIUS,
    angle: -Math.PI / 2, // facing up the archive at the start
    sneaking: false,
    moving: false,
    stepPhase: 0, // drives the footstep sound and the walk bob
    stepAcc: 0,
    coins: COIN_COUNT,
    documents: 0,
    coinsUsed: 0,
    alertsTriggered: 0,
  };
}

// A tossed coin: it flies, lands, and pings. The throw is a straight line
// toward the aim point, capped at COIN_RANGE.
export function makeCoin(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  const range = Math.min(dist, COIN_RANGE);
  const nx = dist > 0 ? dx / dist : 0;
  const ny = dist > 0 ? dy / dist : 0;
  return {
    x: fromX,
    y: fromY,
    targetX: fromX + nx * range,
    targetY: fromY + ny * range,
    t: 0, // 0 = flying, 1 = landed
    flight: 0.45, // seconds in the air
    pingTimer: 0, // seconds the ping ring stays visible
    pinged: false,
  };
}

export function updatePlayer(player, input, level, dt, events) {
  let ix = 0;
  let iy = 0;
  if (input.left) ix -= 1;
  if (input.right) ix += 1;
  if (input.up) iy -= 1;
  if (input.down) iy += 1;

  player.sneaking = input.sneak;
  const speed = player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
  const len = Math.hypot(ix, iy);
  player.moving = len > 0;
  if (len > 0) {
    const nx = (ix / len) * speed * dt;
    const ny = (iy / len) * speed * dt;
    const moved = moveCircle(level, player.x, player.y, player.radius, nx, ny);
    player.x = moved.x;
    player.y = moved.y;
    player.angle = Math.atan2(iy, ix);
    player.stepPhase += (Math.abs(moved.movedX) + Math.abs(moved.movedY)) * 0.055;
    player.stepAcc += Math.abs(moved.movedX) + Math.abs(moved.movedY);
    // A footstep sound every ~26 px of travel, only while walking (not sneaking).
    if (!player.sneaking && player.stepAcc > 26) {
      player.stepAcc = 0;
      events.push({ type: 'footstep' });
    }
  }
}

export function updateCoin(coin, dt, events) {
  if (coin.t < 1) {
    coin.t = Math.min(1, coin.t + dt / coin.flight);
    const eased = coin.t * (2 - coin.t);
    // Lerp from the throw origin, kept on the coin itself.
    coin.x = coin.startX + (coin.targetX - coin.startX) * eased;
    coin.y = coin.startY + (coin.targetY - coin.startY) * eased;
    if (coin.t >= 1 && !coin.pinged) {
      coin.pinged = true;
      coin.pingTimer = 1.4;
      events.push({ type: 'coinPing', x: coin.targetX, y: coin.targetY });
    }
  } else if (coin.pingTimer > 0) {
    coin.pingTimer -= dt;
  }
}

export function startCoinThrow(player, toX, toY) {
  if (player.coins <= 0) return null;
  player.coins -= 1;
  player.coinsUsed += 1;
  const coin = makeCoin(player.x, player.y, toX, toY);
  coin.startX = player.x;
  coin.startY = player.y;
  return coin;
}
