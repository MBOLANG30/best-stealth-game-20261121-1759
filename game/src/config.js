// config.js — every tunable number for Night Shift at the Archive lives here,
// so the level, the guards and the player all agree on one set of rules.

export const TILE = 32;
export const COLS = 40;
export const ROWS = 22;
export const LEVEL_W = COLS * TILE; // 1280
export const LEVEL_H = ROWS * TILE; // 704
export const HUD_H = 32;
export const CANVAS_W = LEVEL_W; // 1280
export const CANVAS_H = HUD_H + LEVEL_H; // 736

// Tile kinds in the level grid.
export const T_FLOOR = 0;
export const T_WALL = 1;
export const T_SHELF = 2;
export const T_CRATE = 3;
export const T_SHADOW = 4; // walkable floor, deep shadow: hard to be seen in

export function isSolid(tile) {
  return tile === T_WALL || tile === T_SHELF || tile === T_CRATE;
}

// Player movement.
export const PLAYER_RADIUS = 11;
export const PLAYER_WALK_SPEED = 132; // px per second
export const PLAYER_SNEAK_SPEED = 68;
export const PLAYER_NOISE_RADIUS = 78; // walking this close to a guard is heard
export const COIN_COUNT = 3;
export const COIN_RANGE = 260; // how far a toss flies
export const COIN_HEAR_RADIUS = 280; // guards inside this hear the ping

// Guard senses.
export const GUARD_RADIUS = 12;
export const GUARD_PATROL_SPEED = 56;
export const GUARD_CHASE_SPEED = 112;
export const GUARD_SEARCH_SPEED = 78;
export const GUARD_VIEW_RANGE = 195; // px, open floor, walking player
export const GUARD_VIEW_HALF_ANGLE = 0.66; // radians (~38 deg each side)
export const GUARD_SHADOW_RANGE_FACTOR = 0.5; // player standing in shadow
export const GUARD_SNEAK_RANGE_FACTOR = 0.62; // player sneaking
export const GUARD_CATCH_RADIUS = 20;
export const GUARD_ALERT_RISE = 62; // alert points per second while seen
export const GUARD_ALERT_RISE_CLOSE = 120; // ...when the player is very close
export const GUARD_ALERT_FALL = 16; // alert points per second while unseen
export const GUARD_SUSPICIOUS_AT = 40; // alert: guard stops and stares
export const GUARD_CHASE_AT = 100; // alert: guard gives chase
export const GUARD_CHASE_MEMORY = 2.6; // seconds a guard keeps chasing unseen
export const GUARD_SEARCH_TIME = 3.2; // seconds a guard looks around a spot

// Scoring flavour.
export const DOCUMENT_COUNT = 3;
export const DEFAULT_SEED = 1234;
