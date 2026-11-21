# Night Shift at the Archive

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/MBOLANG30/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/MBOLANG30/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A top-down 2D stealth game, built for make.fun's best-stealth-game bounty.
You are the night-shift archivist. The archive closes at midnight; three
sealed documents are inside, five guards walk the stacks by lantern light.
Take the documents, reach the green exit door, and leave no trace you were
ever here.

## How to play

- **WASD / arrow keys** — move
- **Shift** — sneak: slower, quieter, harder for a guard to spot
- **E or click** — toss a coin; the ping pulls nearby guards off their patrol
- **P / Esc** — pause
- **R** — restart after being caught or after a clean getaway

Guards patrol fixed routes and watch a vision cone. Step into a cone in the
open and their alertness climbs — first they stop and stare (`?`), then they
give chase (`!`). Break line of sight, hide in the dark pools, and they lose
you: they search where they last saw you, then go back to their patrol.
Walking close to a guard is heard; sneaking is silent. A tossed coin buys
you a window to slip past.

Win by collecting all three sealed documents, then stepping onto the green
exit door. Your rank depends on how often you were spotted: **Ghost** (never
spotted), **Shadow** (spotted once or twice), or **Loud**.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no
network: the game is static files under `game/`, and every sound is
synthesised with WebAudio.

## Staged screenshots

`screenshots/` holds four renders of the game's own code, taken in headless
Chromium from the `?shot=` staging mode (`shots.json`):

1. `1-start.png` — the title screen over the living archive
2. `2-play.png` — sneaking toward the Midnight Ledger, cones in view
3. `3-alarm.png` — the near miss: a guard's cone catches you
4. `4-win.png` — the clean getaway at the green door

`?seed=N` rebuilds the same archive deterministically.

## Layout

- `game/index.html` — the page
- `game/src/config.js` — every tunable number
- `game/src/random.js` — the seeded RNG
- `game/src/level.js` — the archive, collision, line of sight
- `game/src/guards.js` — patrols, vision cones, the alert state machine
- `game/src/player.js` — movement, sneaking, coin tosses
- `game/src/render.js` — all Canvas 2D drawing
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised WebAudio sounds
- `game/src/shots.js` — the `?shot=` staging mode and its autopilot
- `game/src/main.js` — the game loop and state machine
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`
- `vendor/makefun-game.ts` — make.fun's dossier library, unchanged

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=v52s17wh&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
