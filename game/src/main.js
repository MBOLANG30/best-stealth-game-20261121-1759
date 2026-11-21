// main.js — Night Shift at the Archive: the game itself. It owns the state
// machine (title -> playing -> paused / caught / won), runs the world one
// fixed tick at a time, and hands each frame to the renderer.

import {
  CANVAS_W,
  CANVAS_H,
  DOCUMENT_COUNT,
  DEFAULT_SEED,
  COIN_HEAR_RADIUS,
} from './config.js';
import { buildLevel } from './level.js';
import { makeGuard, updateGuard, distractGuards } from './guards.js';
import { makePlayer, updatePlayer, updateCoin, startCoinThrow } from './player.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { render } from './render.js';
import { shotFromUrl, stageShot } from './shots.js';

const STEP = 1 / 60;

export class Game {
  constructor(canvas, seed = DEFAULT_SEED) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.seed = seed;
    this.audio = new AudioEngine();
    this.input = new Input(canvas);
    this.time = 0; // wall-clock-ish time for animation, always advances
    this.elapsed = 0; // play time, only while playing
    this.state = 'title'; // title | playing | paused | caught | won
    this.frozen = false; // staged shots stop the world after staging
    this.started = false;
    this.caughtBy = null;
    this.coin = null;
    this.shot = shotFromUrl(window.location);
    this.reset();
    if (this.shot) {
      stageShot(this, this.shot.shot);
      this.paint();
      window.__shotReady = true;
    }
  }

  reset() {
    this.level = buildLevel(this.seed);
    this.player = makePlayer(this.level.playerStart);
    this.guards = this.level.routes.map((route, i) => makeGuard(route, i));
    this.coin = null;
    this.elapsed = 0;
    this.caughtBy = null;
    this.state = 'title';
    this.frozen = false;
    this.started = false;
    this.input.clearPresses();
  }

  startNight() {
    this.reset();
    this.state = 'playing';
    this.started = true;
    this.audio.ensure();
  }

  // One fixed world tick: input, player, guards, pickups, win and caught.
  // Pure game logic — no drawing, no sound calls except through events.
  tickWorld(dt) {
    if (this.state !== 'playing') return;
    this.elapsed += dt;

    // Coin toss: E, a click anywhere on the canvas, or a requested toss
    // (the autopilot's escape throw) — all through the same rule.
    const click = this.input.consumeClick();
    const toss = this.input.coinToss;
    this.input.coinToss = null;
    if ((toss || this.input.wasPressed('KeyE') || click) && this.player.coins > 0) {
      const tx = toss ? toss.x : click ? click.x : this.player.x + Math.cos(this.player.angle) * 200;
      const ty = toss ? toss.y : click ? click.y - 32 : this.player.y + Math.sin(this.player.angle) * 200;
      const coin = startCoinThrow(this.player, tx, ty);
      if (coin) {
        this.coin = coin;
        this.audio.coinPing();
      }
    }

    const events = [];
    updatePlayer(this.player, this.input, this.level, dt, events);
    for (const e of events) {
      if (e.type === 'footstep') this.audio.footstep(this.player.sneaking);
    }

    if (this.coin) {
      const coinEvents = [];
      updateCoin(this.coin, dt, coinEvents);
      for (const e of coinEvents) {
        if (e.type === 'coinPing') {
          distractGuards(this.guards, e.x, e.y, COIN_HEAR_RADIUS);
        }
      }
      if (this.coin.pingTimer <= 0 && this.coin.t >= 1) this.coin = null;
    }

    const guardEvents = [];
    for (let i = 0; i < this.guards.length; i++) {
      updateGuard(this.guards[i], this.level.routes[i], this.player, this.level, dt, guardEvents);
    }
    for (const e of guardEvents) {
      if (e.type === 'spotted') {
        this.player.alertsTriggered += 1;
        this.audio.alertSting();
      } else if (e.type === 'lost') {
        this.audio.lostSting();
      } else if (e.type === 'caught') {
        this.caughtBy = e.guard.name;
        this.state = 'caught';
        this.audio.caughtSting();
      }
    }
    if (this.state !== 'playing') return;

    // Pick up a sealed document by walking over it.
    for (const doc of this.level.documents) {
      if (doc.taken) continue;
      if (Math.hypot(doc.x - this.player.x, doc.y - this.player.y) < 24) {
        doc.taken = true;
        this.player.documents += 1;
        this.audio.pickupChime();
        if (this.player.documents >= DOCUMENT_COUNT) {
          this.level.exit.open = true;
          this.audio.doorOpen();
        }
      }
    }

    // Step onto the open exit with all three documents: out, unseen.
    if (this.level.exit.open) {
      const dx = this.level.exit.x - this.player.x;
      const dy = this.level.exit.y - this.player.y;
      if (Math.hypot(dx, dy) < 26) {
        this.state = 'won';
        this.audio.winChime();
      }
    }
  }

  // Menu keys and pause, handled once per animation frame.
  handleMenus() {
    if (this.input.wasPressed('Enter')) {
      if (this.state === 'title') this.startNight();
      return;
    }
    if (this.input.wasPressed('KeyR')) {
      if (this.state === 'caught' || this.state === 'won') this.startNight();
      return;
    }
    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.input.clearPresses();
      } else if (this.state === 'paused') {
        this.state = 'playing';
        this.input.clearPresses();
      }
    }
    // A click on the title screen also starts the night.
    if (this.state === 'title' && this.input.consumeClick()) {
      this.startNight();
    }
    // Any key or click is a gesture: wake the audio engine.
    if (this.input.pressedKeys.size > 0) this.audio.ensure();
  }

  paint() {
    render(this.ctx, this);
  }

  frame(now) {
    if (this.frozen) return;
    const dt = STEP;
    this.time += dt;
    this.handleMenus();
    if (this.state === 'playing') this.tickWorld(dt);
    this.paint();
  }

  run() {
    if (this.shot) return; // staged shots already painted their frozen frame
    const loop = () => {
      this.frame();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.__shotReady = true;
  }
}

export function boot() {
  const canvas = document.getElementById('game');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const seedParam = new URLSearchParams(window.location.search).get('seed');
  const seed = seedParam !== null && Number.isFinite(Number(seedParam)) ? Number(seedParam) : DEFAULT_SEED;
  const game = new Game(canvas, seed);
  window.__game = game;
  game.run();
  return game;
}

boot();
