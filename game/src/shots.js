// shots.js — staged screenshots. ?shot=start|play|end plays the real rules
// forward from a fresh world with a simple autopilot, freezes the frame,
// and sets window.__shotReady once it is painted. No shot is faked: the
// autopilot only presses the same virtual keys a player would.

import { canSeePlayer } from './guards.js';
import { TILE, T_SHADOW, COLS, ROWS, isSolid } from './config.js';

// A shortest path over the tile grid (Dijkstra): the autopilot follows real
// corridors instead of pushing into bookcases. A `danger` callback marks
// tiles a guard can currently see; stepping on one costs far more than a
// safe tile, so the path slips around vision cones where it can.
export function findPath(level, fromX, fromY, toX, toY, danger = null) {
  const start = { x: Math.floor(fromX / TILE), y: Math.floor(fromY / TILE) };
  const goal = { x: Math.floor(toX / TILE), y: Math.floor(toY / TILE) };
  const key = (x, y) => `${x},${y}`;
  const cost = new Map([[key(start.x, start.y), 0]]);
  const prev = new Map();
  const open = [start];
  const closed = new Set();
  while (open.length > 0) {
    // Cheapest first (the grid is small; a linear scan is plenty).
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (cost.get(key(open[i].x, open[i].y)) < cost.get(key(open[bi].x, open[bi].y))) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    const curKey = key(cur.x, cur.y);
    if (closed.has(curKey)) continue;
    closed.add(curKey);
    if (cur.x === goal.x && cur.y === goal.y) {
      const tiles = [];
      let at = cur;
      while (at) {
        tiles.unshift(at);
        at = prev.get(key(at.x, at.y));
      }
      return tiles.map((t) => ({ x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 }));
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (isSolid(level.get(nx, ny))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const stepCost = danger && danger(nx, ny) ? 101 : 1;
      const nc = cost.get(curKey) + stepCost;
      if (nc < (cost.get(nk) ?? Infinity)) {
        cost.set(nk, nc);
        prev.set(nk, cur);
        open.push({ x: nx, y: ny });
      }
    }
  }
  return null;
}

export function shotFromUrl(url) {
  const params = new URLSearchParams(url.search);
  const shot = params.get('shot');
  if (shot !== 'start' && shot !== 'play' && shot !== 'alarm' && shot !== 'end') return null;
  const seed = Number(params.get('seed') || '1234');
  return { shot, seed: Number.isFinite(seed) ? seed : 1234 };
}

// The nearest shadow tile no guard can see into right now — a hiding spot.
// A spot counts only when it is out of every guard's vision cone and more
// than a sight-range away from every guard, so the watch cannot sweep it
// while the player waits there. Falls back to the nearest shadow tile.
export function nearestHidingSpot(level, guards, fromX, fromY) {
  let best = null;
  let bestD = Infinity;
  let anyBest = null;
  let anyD = Infinity;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      if (level.get(tx, ty) !== T_SHADOW) continue;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      const d = Math.hypot(cx - fromX, cy - fromY);
      if (d < anyD) {
        anyD = d;
        anyBest = { x: cx, y: cy };
      }
      const exposed = guards.some(
        (g) =>
          canSeePlayer(g, { x: cx, y: cy, sneaking: true }, level) ||
          Math.hypot(g.x - cx, g.y - cy) < 160,
      );
      if (exposed) continue;
      if (d < bestD) {
        bestD = d;
        best = { x: cx, y: cy };
      }
    }
  }
  return best ?? anyBest;
}

// The autopilot: follow a grid path toward a target, sneak when a guard is
// close, and fall back to a hiding spot whenever a guard gets suspicious.
// It only ever sets the same input flags a keyboard would.
export class Autopilot {
  constructor(game) {
    this.game = game;
    this.targets = [];
    this.path = [];
    this.pathFor = null;
    this.pathAge = 0;
    this.bold = false; // a bold autopilot walks into the lamplight on purpose
    this.retreating = false;
    this.hideTarget = null;
  }

  setTargets(tiles) {
    this.targets = tiles.map((t) => ({ x: t.x, y: t.y }));
    this.path = [];
    this.pathFor = null;
    this.retreating = false;
    this.hideTarget = null;
  }

  currentTarget() {
    return this.targets[0] ?? null;
  }

  advanceTarget() {
    this.targets.shift();
    this.path = [];
    this.pathFor = null;
  }

  // Can any guard see this point right now? (Probed as a sneaking player:
  // the autopilot plans for the cautious case.)
  dangerAt(x, y) {
    const probe = { x, y, sneaking: true };
    return this.game.guards.some((g) => canSeePlayer(g, probe, this.game.level));
  }

  // Steer one tick toward a point, following the grid path to it.
  steerToward(point, dt) {
    const game = this.game;
    const player = game.player;
    const input = game.input;
    if (this.path.length === 0 || this.pathFor !== point || this.pathAge > 20) {
      const danger = (tx, ty) => this.dangerAt(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
      this.path = findPath(game.level, player.x, player.y, point.x, point.y, danger) ?? [];
      this.pathFor = point;
      this.pathAge = 0;
      if (this.path.length > 0) this.path.shift();
    }
    this.pathAge += 1;
    const node = this.path[0];
    if (!node) {
      const dx = point.x - player.x;
      const dy = point.y - player.y;
      if (dx > 4) input.right = true;
      if (dx < -4) input.left = true;
      if (dy > 4) input.down = true;
      if (dy < -4) input.up = true;
      return;
    }
    // Wait for a patrol's cone to sweep off the next step rather than
    // walking into it — unless we are already standing in the open, in
    // which case waiting only gets us caught.
    if (this.dangerAt(node.x, node.y) && !this.dangerAt(player.x, player.y)) return;
    const ndx = node.x - player.x;
    const ndy = node.y - player.y;
    if (Math.hypot(ndx, ndy) < 10) {
      this.path.shift();
      return;
    }
    if (ndx > 4) input.right = true;
    if (ndx < -4) input.left = true;
    if (ndy > 4) input.down = true;
    if (ndy < -4) input.up = true;
  }

  // One tick of autopilot input. Returns true when the route is finished.
  step(dt) {
    const game = this.game;
    const player = game.player;
    const input = game.input;

    input.up = input.down = input.left = input.right = false;
    input.sneak = false;

    const target = this.currentTarget();
    if (!target) return true;

    // Arrived? Move on to the next target.
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    if (Math.hypot(dx, dy) < 18) {
      this.advanceTarget();
      return this.targets.length === 0;
    }

    // Heat check: a suspicious or chasing guard sends the autopilot to a
    // hiding spot until the watch calms down. A bold autopilot skips this
    // and walks straight into the lamplight instead.
    const hottest = Math.max(0, ...game.guards.map((g) => g.alert));
    const anyChase = game.guards.some((g) => g.state === 'chase');
    if (!this.bold && (anyChase || hottest > 20)) {
      // A chase is the moment for a coin: throw it past the guard so the
      // ping pulls them off the trail, then slip away.
      if (anyChase && player.coins > 0 && !game.coin && !input.coinToss) {
        const chaser = game.guards.find((g) => g.state === 'chase');
        if (chaser) {
          const dx = chaser.x - player.x;
          const dy = chaser.y - player.y;
          const len = Math.hypot(dx, dy) || 1;
          input.coinToss = {
            x: Math.max(40, Math.min(1240, chaser.x + (dx / len) * 160)),
            y: Math.max(40, Math.min(664, chaser.y + (dy / len) * 160)),
          };
        }
      }
      if (!this.retreating) {
        this.retreating = true;
        this.hideTarget = nearestHidingSpot(game.level, game.guards, player.x, player.y);
        this.path = [];
        this.pathFor = null;
      }
      if (this.hideTarget) {
        // Run, don't sneak, when a guard is actually chasing: a chasing
        // guard is faster than a sneaking player. Otherwise slip away quietly.
        input.sneak = !anyChase;
        // Already standing in a cone: run straight away from the guard
        // that spotted us instead of following a path through it.
        if (this.dangerAt(player.x, player.y)) {
          const hotGuard = game.guards.reduce((a, b) => (b.alert > a.alert ? b : a), game.guards[0]);
          const fx = player.x - hotGuard.x;
          const fy = player.y - hotGuard.y;
          input.sneak = false; // fleeing is a run, not a sneak
          if (fx > 8) input.right = true;
          if (fx < -8) input.left = true;
          if (fy > 8) input.down = true;
          if (fy < -8) input.up = true;
          return false;
        }
        this.steerToward(this.hideTarget, dt);
      }
      if (!anyChase && hottest < 8) {
        this.retreating = false;
        this.hideTarget = null;
        this.path = [];
        this.pathFor = null;
      }
      return false;
    }
    this.retreating = false;
    this.hideTarget = null;

    // Sneak when a guard could see us from here.
    const watched = game.guards.some((g) => canSeePlayer(g, player, game.level));
    if (watched) input.sneak = true;

    this.steerToward(target, dt);
    return false;
  }
}

// Run the world forward for one staged shot, then freeze it.
// `game` must already be fresh (new Game). Returns nothing; the game ends
// frozen on the frame the screenshot wants.
export function stageShot(game, shot) {
  const dt = 1 / 60;
  if (shot === 'start') {
    // Title over a living archive: let the guards walk a few seconds so
    // their cones sit mid-patrol, then hold on the title screen.
    game.state = 'playing';
    game.started = true;
    for (let i = 0; i < 240; i++) game.tickWorld(dt);
    game.state = 'title';
    game.frozen = true;
    return;
  }

  const pilot = new Autopilot(game);
  game.state = 'playing';
  game.started = true;

  if (shot === 'play') {
    // Sneak toward the middle document and freeze mid-approach, close
    // enough to a patrol that a cone is in frame.
    pilot.setTargets([game.level.documents[1]]);
    for (let i = 0; i < 900; i++) {
      if (game.state !== 'playing') break;
      pilot.step(dt);
      game.tickWorld(dt);
      if (game.player.documents > 0) break;
    }
    // If the first attempt was caught, walk the same route on tiptoe.
    if (game.state === 'caught') {
      game.reset();
      game.state = 'playing';
      game.started = true;
      const cautious = new Autopilot(game);
      cautious.setTargets([game.level.documents[1]]);
      for (let i = 0; i < 900; i++) {
        if (game.state !== 'playing') break;
        cautious.step(dt);
        game.input.sneak = true;
        game.tickWorld(dt);
        if (game.player.documents > 0) break;
      }
    }
    game.frozen = true;
    return;
  }

  // alarm: walk boldly toward the middle document until a guard's cone
  // catches you — freeze on the near miss, "?" or "!" above their head.
  if (shot === 'alarm') {
    pilot.bold = true; // walk straight into the lamplight on purpose
    pilot.setTargets([game.level.documents[1]]);
    for (let i = 0; i < 1200; i++) {
      if (game.state !== 'playing') break;
      pilot.step(dt);
      game.input.sneak = false; // no tiptoeing: straight into the lamplight
      game.tickWorld(dt);
      const hot = game.guards.some((g) => g.state === 'chase' || g.state === 'suspicious');
      if (hot) break;
    }
    game.frozen = true;
    return;
  }

  // end: work the whole night — all three documents, then the exit.
  const docs = game.level.documents;
  pilot.setTargets([...docs, game.level.exit]);
  for (let i = 0; i < 20000; i++) {
    if (game.state !== 'playing') break;
    // Pick up documents the autopilot walks over: the real pickup rule.
    pilot.step(dt);
    game.tickWorld(dt);
    if (game.state === 'won') break;
  }
  // If the autopilot was caught on the way, rewind to a fresh world and
  // walk the same route more patiently: sneak the whole way.
  if (game.state === 'caught') {
    game.reset();
    game.state = 'playing';
    game.started = true;
    const cautious = new Autopilot(game);
    cautious.setTargets([...game.level.documents, game.level.exit]);
    for (let i = 0; i < 20000; i++) {
      if (game.state !== 'playing') break;
      cautious.step(dt);
      game.input.sneak = true; // the whole night, on tiptoe
      game.tickWorld(dt);
      if (game.state === 'won') break;
    }
  }
  game.frozen = true;
}
