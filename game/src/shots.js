// The screenshot scenes behind ?shot=start|play|play2|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (for each lane, check whether anything dangerous will be there in the
// next moment; among the safe lanes, steer toward the nearest coin, passenger or
// destination gate), so the frame is what a short game really looks like and the
// same seed always gives the same frame.
import { FIELD, LANES, STEP, PLAYER } from './config.js';
import { createWorld, EVENT_OVER, EVENT_WIN, KIND_CAR, KIND_BAJAJ, KIND_ANGKOT, KIND_TRUCK, KIND_POTHOLE, KIND_COIN, KIND_PASSENGER, KIND_GATE } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 24;
const PLAY2_SECONDS = 52;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;
const DANGER = new Set([KIND_CAR, KIND_BAJAJ, KIND_ANGKOT, KIND_TRUCK, KIND_POTHOLE]);

/** Would lane `lane` be hit within `horizon` seconds if the player stays there? */
function laneDanger(state, lane, horizon, speed) {
  const py = state.player.y;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    for (const e of state.entities) {
      if (!e.active || !DANGER.has(e.kind) || e.lane !== lane) continue;
      // Already past the bike and moving away: it can never hit.
      if (e.y - py > (e.h + PLAYER.height) / 2 - 8) continue;
      const y = e.y + (speed - e.speed) * t;
      if (Math.abs(y - py) < (e.h + PLAYER.height) / 2 - 8) return t;
    }
  }
  return Infinity;
}

export function autopilot(world, horizon, chase) {
  const state = world.state;
  const speed = 430 * (1 + (state.level - 1) * 0.07);
  // Target: the destination gate while carrying, the waiting passenger while
  // waiting, and only coins in between — a coin never lures the bike away
  // from a passenger who is already aboard.
  let targetLane = null;
  if (chase) {
    if (state.passengerPhase === 'carrying' && state.gate) {
      targetLane = state.gate.lane;
    } else if (state.passengerPhase === 'waiting' && state.passenger) {
      targetLane = state.passenger.lane;
    } else {
      let targetY = Infinity;
      for (const e of state.entities) {
        if (!e.active) continue;
        if (e.kind === KIND_COIN && e.y < targetY && e.y > -50) { targetLane = e.lane; targetY = e.y; }
      }
    }
  }
  const current = state.player.lane;
  const wanted = targetLane === null ? current : targetLane;
  // Only the neighbouring lanes are reachable in one step — a lane change is a
  // single move, and the bike is committed to the lane it passes through, so
  // the pilot never aims two lanes away across traffic it has not checked.
  const candidates = [current - 1, current, current + 1].filter((l) => l >= 0 && l <= 2);
  const ordered = [wanted, current, ...candidates].filter((v, i, a) => a.indexOf(v) === i && candidates.includes(v));
  // Prefer the wanted lane if it is next door and safe; otherwise the lane
  // that stays safe longest.
  let best = current;
  let bestTime = -1;
  for (const lane of ordered) {
    const t = laneDanger(state, lane, horizon, speed);
    if (lane === wanted && t === Infinity) return Math.sign(lane - current);
    if (t > bestTime) { bestTime = t; best = lane; }
  }
  return Math.sign(best - current);
}

/**
 * Set `world` to the named scene and return the screen to draw over it, the best
 * score to show, and whether the scene is a win. Any unknown name is the title.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'win') {
    // Play a full shift with the good autopilot until it wins (or the clock
    // runs out): stages the victory screen for a screenshot check.
    let won = false;
    let over = false;
    for (let i = 0; i < 95 / STEP; i += 1) {
      const events = world.step(STEP, autopilot(world, 1.2, true), false, false, false);
      if (events & EVENT_WIN) { won = true; over = true; break; }
      if (events & EVENT_OVER) { over = true; break; }
    }
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score, won };
  }
  if (name !== 'play' && name !== 'play2' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, 0, false, false, true);
    return { screen: SCREEN_TITLE, best: 0, won: false };
  }
  const seconds = name === 'play' ? PLAY_SECONDS : name === 'play2' ? PLAY2_SECONDS : END_LIMIT_SECONDS;
  const horizon = name === 'end' ? 0.22 : 1.2;
  const chase = name !== 'end';
  let won = false;
  let over = false;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world, horizon, chase), false, false, false);
    if (events & EVENT_WIN) { won = true; over = true; break; }
    if (events & EVENT_OVER) { over = true; break; }
  }
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score, won };
}
