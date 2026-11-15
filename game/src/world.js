// Ojek Rush world: the simulation. A fixed-step update moves traffic down the road,
// picks up passengers, delivers them, and counts rupiah. No drawing here.
//
// Flow: a passenger waits at the roadside (state 'waiting'); ride into their lane
// to pick them up ('carrying'); a green destination gate appears ahead — ride
// through it in the marked lane to deliver ('delivered'). Deliver
// DELIVERIES_TO_WIN passengers before the 90-second shift ends to win; lose all
// 3 helmets (lives) to crashes, or run out of shift time, and the shift is over.
import {
  FIELD, ROAD, LANES, PLAYER_Y, STEP, SHIFT_SECONDS, DELIVERIES_TO_WIN, LIVES,
  PLAYER, PAY, SPAWN, PASSENGER_PATIENCE, PASSENGERS, CRASH_QUIPS, NEAR_MISS_QUIPS,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1 << 0;
export const EVENT_OVER = 1 << 1;
export const EVENT_WIN = 1 << 2;
export const EVENT_COIN = 1 << 3;
export const EVENT_PICKUP = 1 << 4;
export const EVENT_DELIVER = 1 << 5;
export const EVENT_NEAR_MISS = 1 << 6;

export const KIND_CAR = 'car';
export const KIND_BAJAJ = 'bajaj';
export const KIND_ANGKOT = 'angkot';
export const KIND_TRUCK = 'truck';
export const KIND_POTHOLE = 'lubang';
export const KIND_COIN = 'koin';
export const KIND_PASSENGER = 'penumpang';
export const KIND_GATE = 'tujuan';

const VEHICLES = [
  { kind: KIND_CAR, w: 86, h: 148, speed: [170, 250], weight: 5 },
  { kind: KIND_BAJAJ, w: 70, h: 108, speed: [190, 230], weight: 3 },
  { kind: KIND_ANGKOT, w: 90, h: 168, speed: [150, 190], weight: 3 },
  { kind: KIND_TRUCK, w: 96, h: 205, speed: [130, 160], weight: 2 },
];

const CAR_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22'];
const MAX_ENTITIES = 96;

function makeEntity(kind, lane, y, rng) {
  const base = { kind, lane, x: LANES[lane], y, active: true, passed: false, wobble: rng.next() * Math.PI * 2 };
  if (kind === KIND_COIN) return { ...base, w: 34, h: 34, speed: 0, color: '#f2c94c' };
  if (kind === KIND_POTHOLE) return { ...base, w: 74, h: 42, speed: 0, color: '#241f2e' };
  if (kind === KIND_PASSENGER) return { ...base, w: 56, h: 84, speed: 230, color: '#ff8fab' }; // strolls toward the bike: ~3.5 s to line up a pickup
  if (kind === KIND_GATE) return { ...base, w: 150, h: 60, speed: 230, color: '#22c55e' }; // the gate approaches slowly too, so the delivery can be lined up
  const spec = VEHICLES.find((v) => v.kind === kind);
  return {
    ...base,
    w: spec.w,
    h: spec.h,
    speed: rng.range(spec.speed[0], spec.speed[1]),
    color: CAR_COLORS[Math.floor(rng.next() * CAR_COLORS.length)],
  };
}

export function createWorld(rng) {
  const state = {
    time: 0,
    shiftLeft: SHIFT_SECONDS,
    score: 0, // rupiah
    deliveries: 0,
    lives: LIVES,
    level: 1,
    combo: 0,
    speedMul: 1, // 1 normal, 1.35 gas, 0.6 brake
    distance: 0,
    invulnerable: 0,
    shake: 0,
    quip: '',
    quipUntil: 0,
    passengerPhase: 'waiting', // waiting | carrying | gap
    passenger: null,
    patience: 0,
    gate: null,
    gapTimer: 0,
    spawnTimer: 0.4,
    coinTimer: 0.7,
    corridorLane: 1,
    corridorRows: 3,
    meterAcc: 0,
    nearMissCooldown: 0,
    scroll: 0,
    decor: [],
    entities: [],
    player: { lane: 1, x: LANES[1], y: PLAYER_Y, targetX: LANES[1] },
  };

  for (let i = 0; i < MAX_ENTITIES; i += 1) {
    state.entities.push({ kind: KIND_CAR, lane: 0, y: -9999, active: false, w: 0, h: 0, speed: 0, color: '#000', passed: false, wobble: 0 });
  }

  function spawnDecor() {
    // Roadside life: trees, warung stalls and billboards scrolling past.
    const side = rng.next() < 0.5 ? 'left' : 'right';
    const kind = rng.pick(['tree', 'tree', 'stall', 'billboard', 'tree']);
    const x = side === 'left' ? rng.range(40, 300) : rng.range(980, 1240);
    state.decor.push({ kind, side, x, y: -80, variant: rng.int(0, 5), text: rng.pick(['SATE AYAM 10RB', 'KOPI HITAM', 'ES TEH JUMBO 5RB', 'TAMBAL BAN 24 JAM', 'NASI PADANG']) });
    if (state.decor.length > 40) state.decor.splice(0, state.decor.length - 40);
  }

  function freeEntity() {
    return state.entities.find((e) => !e.active);
  }

  function spawnVehicleRow() {
    // Never block all three lanes at once: at most two obstacles per row, and a
    // row is skipped often enough that the player can always thread through.
    // Rows fall at different speeds (a pothole closes on a truck ahead of it),
    // so per-row fairness is not enough: a "corridor" lane stays free for
    // several rows in a row, and only then moves, so there is always one lane
    // a player can sit in while the traffic passes.
    if (state.corridorRows <= 0) {
      state.corridorLane = rng.int(0, 2);
      state.corridorRows = 3 + rng.int(0, 2);
    }
    state.corridorRows -= 1;
    const open = [0, 1, 2].filter((l) => l !== state.corridorLane).sort(() => rng.next() - 0.5);
    const count = rng.next() < 0.6 ? 1 : 2;
    const used = new Set();
    for (let i = 0; i < count; i += 1) {
      const slot = freeEntity();
      if (!slot) return;
      let total = 0;
      for (const v of VEHICLES) total += v.weight;
      let roll = rng.next() * total;
      let kind = KIND_CAR;
      for (const v of VEHICLES) { roll -= v.weight; if (roll <= 0) { kind = v.kind; break; } }
      Object.assign(slot, makeEntity(kind, open[i], -180 - rng.range(0, 60), rng));
      used.add(open[i]);
    }
    // A pothole sometimes joins the row — only when one lane is still free.
    if (count === 1 && rng.next() < 0.35) {
      const freeLane = open.find((l) => !used.has(l));
      if (freeLane !== undefined) {
        const slot = freeEntity();
        if (slot) Object.assign(slot, makeEntity(KIND_POTHOLE, freeLane, -140, rng));
      }
    }
  }

  function spawnCoinRow() {
    const lane = rng.int(0, 2);
    for (let i = 0; i < 3; i += 1) {
      const slot = freeEntity();
      if (!slot) return;
      Object.assign(slot, makeEntity(KIND_COIN, lane, -60 - i * 56, rng));
    }
  }

  function spawnPassenger() {
    const lane = rng.int(0, 2);
    const slot = freeEntity();
    if (!slot) return;
    const info = rng.pick(PASSENGERS);
    Object.assign(slot, makeEntity(KIND_PASSENGER, lane, -120, rng));
    slot.info = info;
    state.passenger = slot;
    state.passengerPhase = 'waiting';
    state.patience = PASSENGER_PATIENCE;
  }

  function spawnGate() {
    const lane = rng.int(0, 2);
    const slot = freeEntity();
    if (!slot) return;
    Object.assign(slot, makeEntity(KIND_GATE, lane, -140, rng));
    state.gate = slot;
  }

  function overlaps(a, b, shrink) {
    return (
      a.x - a.w / 2 + shrink < b.x + b.w / 2 - shrink &&
      a.x + a.w / 2 - shrink > b.x - b.w / 2 + shrink &&
      a.y - a.h / 2 + shrink < b.y + b.h / 2 - shrink &&
      a.y + a.h / 2 - shrink > b.y - b.h / 2 + shrink
    );
  }

  function playerBox() {
    // Collisions use the lane the bike is committed to, not the pixels it is
    // still sliding through: a lane change is a discrete move, so the bike
    // never clips a car in the lane it is passing through.
    return { x: LANES[state.player.lane], y: state.player.y, w: PLAYER.width, h: PLAYER.height };
  }

  function worldSpeed() {
    return PLAYER.baseSpeed * state.speedMul * (1 + (state.level - 1) * 0.07);
  }

  function reset() {
    state.time = 0;
    state.shiftLeft = SHIFT_SECONDS;
    state.score = 0;
    state.deliveries = 0;
    state.lives = LIVES;
    state.level = 1;
    state.combo = 0;
    state.distance = 0;
    state.invulnerable = 0;
    state.shake = 0;
    state.quip = '';
    state.passengerPhase = 'waiting';
    state.passenger = null;
    state.patience = 0;
    state.gate = null;
    state.gapTimer = 0;
    state.spawnTimer = 0.5;
    state.coinTimer = 0.9;
    state.meterAcc = 0;
    state.nearMissCooldown = 0;
    state.scroll = 0;
    state.decor = [];
    for (const e of state.entities) e.active = false;
    state.player.lane = 1;
    state.player.x = LANES[1];
    state.player.targetX = LANES[1];
    state.player.y = PLAYER_Y;
    // A little life on the roadside before the first frame.
    for (let i = 0; i < 10; i += 1) {
      const side = rng.next() < 0.5 ? 'left' : 'right';
      state.decor.push({ kind: rng.pick(['tree', 'tree', 'stall', 'billboard']), side, x: side === 'left' ? rng.range(40, 300) : rng.range(980, 1240), y: rng.range(-40, FIELD.height), variant: rng.int(0, 5), text: rng.pick(['SATE AYAM 10RB', 'KOPI HITAM', 'ES TEH JUMBO 5RB', 'TAMBAL BAN 24 JAM']) });
    }
    spawnPassenger();
  }

  /**
   * Advance the world one fixed step. `laneMove` is -1, 0 or 1 (change lane),
   * `gas` true speeds up, `brake` true slows down. `attract` (title screen)
   * runs the street without passengers, timer or crashes. Returns event bits.
   */
  function step(dt, laneMove, gas, brake, attract) {
    let events = EVENT_NONE;
    state.time += dt;
    if (state.invulnerable > 0) state.invulnerable -= dt;
    if (state.shake > 0) state.shake -= dt;
    if (state.nearMissCooldown > 0) state.nearMissCooldown -= dt;

    state.speedMul = gas ? PLAYER.gasMul : brake ? PLAYER.brakeMul : 1;
    const speed = worldSpeed();
    state.scroll += speed * dt;
    state.distance += speed * dt;

    // Lane sliding, smooth rather than a teleport.
    if (laneMove !== 0 && !attract) {
      const next = Math.min(2, Math.max(0, state.player.lane + laneMove));
      if (next !== state.player.lane) {
        state.player.lane = next;
        state.player.targetX = LANES[next];
      }
    }
    const dx = state.player.targetX - state.player.x;
    const maxSlide = (LANES[1] - LANES[0]) * (dt / PLAYER.laneTime);
    state.player.x += Math.abs(dx) <= maxSlide ? dx : Math.sign(dx) * maxSlide;
    // Gas/brake nudge the bike up and down the screen a little.
    const targetY = PLAYER_Y + (gas ? -26 : brake ? 22 : 0);
    state.player.y += (targetY - state.player.y) * Math.min(1, dt * 6);

    // Roadside decor scrolls past and recycles.
    if (rng.next() < dt * 2.2) spawnDecor();
    for (const d of state.decor) d.y += speed * dt * 0.95;
    state.decor = state.decor.filter((d) => d.y < FIELD.height + 120);

    if (!attract) {
      state.shiftLeft -= dt;
      state.meterAcc += dt;
      if (state.meterAcc >= 1) {
        state.meterAcc -= 1;
        state.score += PAY.meterPerSec;
      }
      if (state.passengerPhase === 'carrying') {
        state.patience -= dt;
        if (state.patience <= 0) {
          // Passenger bails: no pay, combo resets, next passenger after a gap.
          state.combo = 0;
          state.quip = 'Penumpang turun di tengah jalan! "Kelamaan, Bang!"';
          state.quipUntil = state.time + 3;
          state.passengerPhase = 'gap';
          state.gapTimer = SPAWN.passengerDelay;
          if (state.gate) { state.gate.active = false; state.gate = null; }
        }
      }
      if (state.passengerPhase === 'gap') {
        state.gapTimer -= dt;
        if (state.gapTimer <= 0) spawnPassenger();
      }

      const interval = Math.max(SPAWN.minInterval, SPAWN.interval * Math.pow(SPAWN.intervalScale, state.level - 1));
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = interval * rng.range(0.85, 1.2);
        spawnVehicleRow();
      }
      state.coinTimer -= dt;
      if (state.coinTimer <= 0) {
        state.coinTimer = SPAWN.coinInterval * rng.range(0.8, 1.4);
        spawnCoinRow();
      }
    } else if (rng.next() < dt * 1.4) {
      // Attract mode: a few cars cruise by so the title screen feels alive.
      spawnVehicleRow();
    }

    const p = playerBox();
    for (const e of state.entities) {
      if (!e.active) continue;
      const rel = speed - e.speed;
      e.y += rel * dt;
      e.wobble += dt * 6;
      if (e.y - e.h / 2 > FIELD.height + 120) {
        // Near miss: a vehicle that just slid past the bike, close but untouched.
        if (!attract && !e.passed && (e.kind === KIND_CAR || e.kind === KIND_BAJAJ || e.kind === KIND_ANGKOT || e.kind === KIND_TRUCK)) {
          e.passed = true;
          if (state.nearMissCooldown <= 0 && Math.abs(e.x - LANES[state.player.lane]) < 130 && state.invulnerable <= 0) {
            state.nearMissCooldown = 2;
            state.quip = rng.pick(NEAR_MISS_QUIPS);
            state.quipUntil = state.time + 1.6;
            state.score += 500;
            events |= EVENT_NEAR_MISS;
          }
        }
        e.active = false;
        if (state.passenger === e) {
          state.passenger = null;
          // The waiting passenger scrolled past unpicked: another one shows
          // up after a short gap instead of the street going quiet forever.
          if (state.passengerPhase === 'waiting') {
            state.passengerPhase = 'gap';
            state.gapTimer = SPAWN.passengerDelay;
          }
        }
        if (state.gate === e) {
          state.gate = null;
          // Missed the gate: it loops around for another try while the
          // passenger is still aboard (their patience still ticks down).
          if (state.passengerPhase === 'carrying') spawnGate();
        }
        continue;
      }
      if (attract) continue;
      const box = { x: LANES[e.lane], y: e.y, w: e.w, h: e.h };
      if (e.kind === KIND_PASSENGER) box.x = LANES[e.lane];
      if (e.kind === KIND_GATE) box.x = LANES[e.lane];
      if (!overlaps(p, box, e.kind === KIND_COIN ? 2 : 10)) continue;

      if (e.kind === KIND_COIN) {
        e.active = false;
        state.score += PAY.coin;
        events |= EVENT_COIN;
      } else if (e.kind === KIND_PASSENGER && state.passengerPhase === 'waiting') {
        e.active = false;
        state.passenger = null;
        state.passengerPhase = 'carrying';
        state.patience = PASSENGER_PATIENCE;
        state.quip = `"${e.info.line}" — ${e.info.name} naik! Tujuan: ${e.info.dest}.`;
        state.quipUntil = state.time + 3.5;
        spawnGate();
        events |= EVENT_PICKUP;
      } else if (e.kind === KIND_GATE && state.passengerPhase === 'carrying') {
        e.active = false;
        state.gate = null;
        const bonus = Math.min(PAY.patienceMax, Math.floor(state.patience) * PAY.patienceBonus);
        state.combo += 1;
        state.deliveries += 1;
        state.score += PAY.delivery + bonus;
        state.level = 1 + state.deliveries;
        state.quip = `SAMPAI! +Rp${(PAY.delivery + bonus).toLocaleString('id-ID')} — ${state.combo}x kombo tanpa nabrak!`;
        state.quipUntil = state.time + 3;
        // A breather after each delivery: the road clears for a moment.
        state.spawnTimer = 2.0;
        state.invulnerable = Math.max(state.invulnerable, 1.0);
        events |= EVENT_DELIVER;
        if (state.deliveries >= DELIVERIES_TO_WIN) {
          events |= EVENT_WIN;
          return events;
        }
        state.passengerPhase = 'gap';
        state.gapTimer = SPAWN.passengerDelay;
      } else if ((e.kind === KIND_CAR || e.kind === KIND_BAJAJ || e.kind === KIND_ANGKOT || e.kind === KIND_TRUCK || e.kind === KIND_POTHOLE) && state.invulnerable <= 0) {
        e.active = false;
        state.lastHit = `${e.kind} lane=${e.lane} y=${e.y.toFixed(0)} h=${e.h} playerLane=${state.player.lane}`;
        state.lives -= 1;
        state.combo = 0;
        state.invulnerable = PLAYER.invulnerable;
        state.shake = 0.45;
        state.quip = rng.pick(CRASH_QUIPS);
        state.quipUntil = state.time + 2.5;
        events |= EVENT_HIT;
        if (state.lives <= 0) {
          events |= EVENT_OVER;
          return events;
        }
      }
    }

    if (!attract && state.shiftLeft <= 0) {
      state.shiftLeft = 0;
      events |= state.deliveries >= DELIVERIES_TO_WIN ? EVENT_WIN : EVENT_OVER;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
