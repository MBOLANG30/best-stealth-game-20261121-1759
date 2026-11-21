// level.js — the archive itself: its walls, shelves, crates, shadow pools,
// the three sealed documents, the exit door, and the guards' patrol routes.
// Also the two questions the whole game keeps asking the grid: "can I stand
// here?" and "can this guard see that spot?".

import {
  COLS,
  ROWS,
  TILE,
  T_FLOOR,
  T_WALL,
  T_SHELF,
  T_CRATE,
  T_SHADOW,
  isSolid,
} from './config.js';
import { makeRng } from './random.js';

// Shelf stacks: [x, y, width] runs of tall bookcases, one tile deep.
const SHELF_RUNS = [
  [4, 4, 6], [12, 4, 6], [21, 4, 6], [30, 4, 6],
  [4, 8, 6], [12, 8, 6], [21, 8, 6], [30, 8, 6],
  [4, 12, 6], [12, 12, 6], [21, 12, 6], [30, 12, 6],
  [4, 16, 6], [12, 16, 6], [21, 16, 6], [30, 16, 6],
];

// Single crates left in the corridors — low cover that breaks line of sight.
const CRATES = [
  [11, 6], [28, 10], [19, 14], [36, 6], [2, 10], [10, 18], [33, 14],
];

// Pools of deep shadow: standing in one halves a guard's sight range.
const SHADOW_RECTS = [
  [2, 18, 4, 2],
  [33, 2, 5, 2],
  [18, 6, 3, 2],
  [10, 14, 2, 2],
  [27, 18, 3, 2],
  [2, 2, 2, 2],
];

// The three sealed documents, in the order the night's work finds them.
const DOCUMENT_TILES = [
  { x: 3, y: 2, name: 'The Founding Charter' },
  { x: 19, y: 10, name: 'The Midnight Ledger' },
  { x: 36, y: 18, name: 'The Sealed Verdict' },
];

export const EXIT_TILE = { x: 38, y: 2 };
export const PLAYER_START_TILE = { x: 2, y: 19 };

// Patrol routes, as tile waypoints. Each guard walks its loop forever.
export const GUARD_ROUTES = [
  {
    name: 'Warden Marlow',
    color: '#e8b64c',
    waypoints: [[3, 6], [18, 6], [36, 6], [18, 6]],
  },
  {
    name: 'Keeper Blythe',
    color: '#7fb3e8',
    waypoints: [[19, 3], [19, 10], [19, 18], [19, 10]],
  },
  {
    name: 'Archivist Fen',
    color: '#c98ae8',
    waypoints: [[3, 14], [18, 14], [36, 14], [18, 14]],
  },
  {
    name: 'Night Porter Quill',
    color: '#8ae8a0',
    waypoints: [[28, 3], [28, 10], [28, 18], [28, 10]],
  },
  {
    name: 'Curator Voss',
    color: '#e87f7f',
    waypoints: [[28, 2], [33, 2], [28, 2]],
  },
];

export function tileCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export function buildLevel(seed) {
  const rng = makeRng(seed);
  const grid = new Uint8Array(COLS * ROWS).fill(T_FLOOR);

  const set = (x, y, t) => {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) grid[y * COLS + x] = t;
  };
  const get = (x, y) => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return T_WALL;
    return grid[y * COLS + x];
  };

  // Border walls.
  for (let x = 0; x < COLS; x++) {
    set(x, 0, T_WALL);
    set(x, ROWS - 1, T_WALL);
  }
  for (let y = 0; y < ROWS; y++) {
    set(0, y, T_WALL);
    set(COLS - 1, y, T_WALL);
  }
  // The exit door replaces one border wall tile with a doorway.
  set(EXIT_TILE.x, EXIT_TILE.y, T_FLOOR);

  for (const [x, y, w] of SHELF_RUNS) {
    for (let i = 0; i < w; i++) set(x + i, y, T_SHELF);
  }
  for (const [x, y] of CRATES) set(x, y, T_CRATE);
  for (const [x, y, w, h] of SHADOW_RECTS) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (get(x + dx, y + dy) === T_FLOOR) set(x + dx, y + dy, T_SHADOW);
      }
    }
  }

  // A few seeded dust motes and scuffs, for the renderer's floor detail.
  const dust = [];
  for (let i = 0; i < 260; i++) {
    dust.push({
      x: rng.range(0, COLS * TILE),
      y: rng.range(0, ROWS * TILE),
      r: rng.range(0.6, 1.8),
      a: rng.range(0.04, 0.14),
    });
  }

  const documents = DOCUMENT_TILES.map((d) => {
    const c = tileCenter(d.x, d.y);
    return { ...d, x: c.x, y: c.y, taken: false, bobPhase: rng.range(0, Math.PI * 2) };
  });
  const exit = tileCenter(EXIT_TILE.x, EXIT_TILE.y);
  const playerStart = tileCenter(PLAYER_START_TILE.x, PLAYER_START_TILE.y);

  return {
    grid,
    get,
    set,
    dust,
    documents,
    exit: { ...exit, open: false },
    playerStart,
    routes: GUARD_ROUTES,
  };
}

// Is the circle (x, y, r) clear of every solid tile?
export function circleClear(level, x, y, r) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isSolid(level.get(tx, ty))) continue;
      const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return false;
    }
  }
  return true;
}

// Move a circle axis by axis so it slides along walls instead of sticking.
export function moveCircle(level, x, y, r, dx, dy) {
  let nx = x;
  if (dx !== 0 && circleClear(level, x + dx, y, r)) nx = x + dx;
  let ny = y;
  if (dy !== 0 && circleClear(level, nx, y + dy, r)) ny = y + dy;
  return { x: nx, y: ny, movedX: nx - x, movedY: ny - y };
}

// Line of sight: true when no solid tile stands between the two points.
// Samples the segment every few pixels — cheap and exact enough at this scale.
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (isSolid(level.get(tx, ty))) return false;
  }
  return true;
}

export function tileAt(level, x, y) {
  return level.get(Math.floor(x / TILE), Math.floor(y / TILE));
}

export function isInShadow(level, x, y) {
  return tileAt(level, x, y) === T_SHADOW;
}
