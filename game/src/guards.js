// guards.js — the night watch. Each guard walks a patrol loop, watches a
// vision cone, and runs a small state machine: patrol -> suspicious -> chase
// -> search -> patrol. A guard that loses you can be shaken off, so a near
// miss is a scare, not a sentence.

import {
  GUARD_RADIUS,
  GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED,
  GUARD_SEARCH_SPEED,
  GUARD_VIEW_RANGE,
  GUARD_VIEW_HALF_ANGLE,
  GUARD_SHADOW_RANGE_FACTOR,
  GUARD_SNEAK_RANGE_FACTOR,
  GUARD_CATCH_RADIUS,
  GUARD_ALERT_RISE,
  GUARD_ALERT_RISE_CLOSE,
  GUARD_ALERT_FALL,
  GUARD_SUSPICIOUS_AT,
  GUARD_CHASE_AT,
  GUARD_CHASE_MEMORY,
  GUARD_SEARCH_TIME,
} from './config.js';
import { hasLineOfSight, isInShadow, moveCircle, circleClear, tileCenter } from './level.js';

export function makeGuard(route, index) {
  const start = tileCenter(route.waypoints[0][0], route.waypoints[0][1]);
  return {
    name: route.name,
    color: route.color,
    x: start.x,
    y: start.y,
    angle: 0,
    state: 'patrol', // patrol | suspicious | chase | search | investigate
    waypointIndex: 1,
    alert: 0,
    lastSeen: null,
    lastSeenTimer: 0,
    searchTimer: 0,
    investigateTarget: null,
    pauseTimer: 0,
    // A guard pauses a beat at each waypoint and looks around, like a person.
    waypointPause: 0,
    // Which way to step around an obstacle: 0 = not avoiding, -1 left, 1 right.
    avoidSide: 0,
    facing: 0,
  };
}

function angleTo(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnToward(guard, targetAngle, rate, dt) {
  const d = angleDiff(targetAngle, guard.angle);
  const step = Math.max(-rate * dt, Math.min(rate * dt, d));
  guard.angle += step;
}

// How far this guard can spot the player right now: shadow and sneaking
// both shrink the range, and a guard that is already chasing sees further.
export function viewRangeFor(guard, player, level) {
  let range = GUARD_VIEW_RANGE;
  if (isInShadow(level, player.x, player.y)) range *= GUARD_SHADOW_RANGE_FACTOR;
  if (player.sneaking) range *= GUARD_SNEAK_RANGE_FACTOR;
  if (guard.state === 'chase') range *= 1.15;
  return range;
}

export function canSeePlayer(guard, player, level) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > viewRangeFor(guard, player, level)) return false;
  if (dist > GUARD_RADIUS + 4) {
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(toPlayer, guard.angle)) > GUARD_VIEW_HALF_ANGLE) return false;
  }
  return hasLineOfSight(level, guard.x, guard.y, player.x, player.y);
}

function walkToward(guard, level, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  const ux = dx / dist;
  const uy = dy / dist;
  const beforeX = guard.x;
  const beforeY = guard.y;
  const moved = moveCircle(level, guard.x, guard.y, GUARD_RADIUS, ux * step, uy * step);
  guard.x = moved.x;
  guard.y = moved.y;
  const progress = Math.hypot(guard.x - beforeX, guard.y - beforeY);
  if (progress < step * 0.35) {
    // Blocked by a crate or shelf: step sideways around it, holding one
    // side until the way forward opens again.
    if (guard.avoidSide === 0) {
      const leftClear = circleClear(level, guard.x - uy * 26, guard.y + ux * 26, GUARD_RADIUS);
      const rightClear = circleClear(level, guard.x + uy * 26, guard.y - ux * 26, GUARD_RADIUS);
      guard.avoidSide = leftClear && !rightClear ? -1 : 1;
    }
    const px = uy * guard.avoidSide;
    const py = -ux * guard.avoidSide;
    const sidestep = moveCircle(level, guard.x, guard.y, GUARD_RADIUS, px * step, py * step);
    guard.x = sidestep.x;
    guard.y = sidestep.y;
  } else {
    guard.avoidSide = 0;
  }
  turnToward(guard, Math.atan2(dy, dx), 5, dt);
  return dist <= step + 1;
}

export function updateGuard(guard, route, player, level, dt, events) {
  const sees = canSeePlayer(guard, player, level);
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);

  // Alertness: rises fast when seen (faster up close), falls when hidden.
  if (sees) {
    const rate = dist < 90 ? GUARD_ALERT_RISE_CLOSE : GUARD_ALERT_RISE;
    guard.alert = Math.min(GUARD_CHASE_AT, guard.alert + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.lastSeenTimer = GUARD_CHASE_MEMORY;
  } else {
    guard.alert = Math.max(0, guard.alert - GUARD_ALERT_FALL * dt);
    guard.lastSeenTimer = Math.max(0, guard.lastSeenTimer - dt);
  }

  // A walking player heard at close range makes a guard turn and wonder.
  if (
    guard.state === 'patrol' &&
    !player.sneaking &&
    dist < 78 &&
    hasLineOfSight(level, guard.x, guard.y, player.x, player.y)
  ) {
    guard.alert = Math.max(guard.alert, GUARD_SUSPICIOUS_AT);
    guard.lastSeen = { x: player.x, y: player.y };
  }

  const wasState = guard.state;
  if (guard.alert >= GUARD_CHASE_AT && guard.state !== 'chase') {
    guard.state = 'chase';
    guard.searchTimer = 0;
    events.push({ type: 'spotted', guard });
  } else if (
    guard.state === 'chase' &&
    !sees &&
    guard.lastSeenTimer <= 0 &&
    guard.alert < GUARD_CHASE_AT
  ) {
    guard.state = 'search';
    guard.searchTimer = GUARD_SEARCH_TIME;
  } else if (guard.state === 'suspicious' && guard.alert < 25) {
    guard.state = 'patrol';
  } else if (
    guard.state === 'patrol' &&
    guard.alert >= GUARD_SUSPICIOUS_AT &&
    guard.alert < GUARD_CHASE_AT
  ) {
    guard.state = 'suspicious';
  }
  if (wasState !== guard.state && guard.state === 'search') {
    events.push({ type: 'lost', guard });
  }

  switch (guard.state) {
    case 'patrol': {
      if (guard.waypointPause > 0) {
        guard.waypointPause -= dt;
        guard.angle += Math.sin(guard.waypointPause * 2.2) * 0.35 * dt;
        break;
      }
      const wp = route.waypoints[guard.waypointIndex];
      const target = tileCenter(wp[0], wp[1]);
      if (walkToward(guard, level, target.x, target.y, GUARD_PATROL_SPEED, dt)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % route.waypoints.length;
        guard.waypointPause = 0.9;
      }
      break;
    }
    case 'suspicious': {
      // Freeze, stare at where the player was last sensed.
      if (guard.lastSeen) turnToward(guard, angleTo(guard.x, guard.y, guard.lastSeen.x, guard.lastSeen.y), 3.2, dt);
      break;
    }
    case 'chase': {
      const target = guard.lastSeen ?? { x: player.x, y: player.y };
      walkToward(guard, level, target.x, target.y, GUARD_CHASE_SPEED, dt);
      if (sees) turnToward(guard, angleTo(guard.x, guard.y, player.x, player.y), 8, dt);
      break;
    }
    case 'search': {
      guard.searchTimer -= dt;
      if (guard.lastSeen) {
        const arrived = walkToward(guard, level, guard.lastSeen.x, guard.lastSeen.y, GUARD_SEARCH_SPEED, dt);
        if (arrived) guard.angle += 1.6 * dt; // look around the spot
      }
      if (guard.searchTimer <= 0) {
        guard.state = 'patrol';
        guard.alert = 0;
        guard.lastSeen = null;
      }
      break;
    }
    case 'investigate': {
      const target = guard.investigateTarget;
      if (!target) {
        guard.state = 'search';
        guard.searchTimer = GUARD_SEARCH_TIME;
        break;
      }
      const arrived = walkToward(guard, level, target.x, target.y, GUARD_SEARCH_SPEED, dt);
      if (arrived) {
        guard.investigateTarget = null;
        guard.state = 'search';
        guard.searchTimer = 2.0;
        guard.lastSeen = { x: target.x, y: target.y };
      }
      break;
    }
    default:
      break;
  }

  // Caught: a chasing guard that reaches the player ends the night.
  if (guard.state === 'chase' && dist < GUARD_CATCH_RADIUS) {
    events.push({ type: 'caught', guard });
  }
}

// A coin ping pulls every guard in earshot off its patrol to look. A loud
// ping right beside a chasing guard breaks its focus too: it investigates
// the coin and loses the trail, its alert dropping back to suspicion.
export function distractGuards(guards, x, y, hearRadius) {
  for (const guard of guards) {
    const dist = Math.hypot(guard.x - x, guard.y - y);
    if (dist > hearRadius) continue;
    guard.state = 'investigate';
    guard.investigateTarget = { x, y };
    guard.alert = Math.min(guard.alert, GUARD_SUSPICIOUS_AT * 1.5);
    guard.lastSeen = null;
    guard.lastSeenTimer = 0;
  }
}
