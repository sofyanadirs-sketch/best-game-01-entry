// Ojek Rush — tuning numbers and colours in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size. All art is drawn in code: no image files, no network.

export const FIELD = { width: 1280, height: 720 };

// Three lanes down Jalan Sudirman. The road runs from x=340 to x=940.
export const ROAD = { left: 340, right: 940 };
export const LANES = [440, 640, 840];
export const PLAYER_Y = 560;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One shift: deliver this many passengers before the clock runs out to win. */
export const SHIFT_SECONDS = 90;
export const DELIVERIES_TO_WIN = 5;
export const LIVES = 3;

export const PLAYER = {
  width: 64,
  height: 92,
  laneTime: 0.16, // seconds to slide into the next lane
  invulnerable: 1.6,
  baseSpeed: 430, // world scroll speed, px/s
  gasMul: 1.35,
  brakeMul: 0.6,
};

// Coins are worth Rp2.000; a delivery pays Rp15.000 plus Rp500 per second left on
// the passenger's own patience timer (max Rp10.000 bonus). The meter ticks Rp500/s.
export const PAY = { coin: 2000, delivery: 15000, patienceBonus: 500, patienceMax: 10000, meterPerSec: 500 };
export const PASSENGER_PATIENCE = 25; // seconds to deliver before the passenger bails

export const SPAWN = {
  interval: 1.15, // seconds between spawn rows at level 1
  intervalScale: 0.93, // per delivery: rows come faster
  minInterval: 0.5,
  coinInterval: 1.1,
  passengerDelay: 1.6, // seconds after a delivery before the next passenger appears
};

export const PALETTE = {
  skyTop: '#2b1e5e',
  skyMid: '#c94b7c',
  skyLow: '#ff9a5c',
  sun: '#ffd166',
  buildingFar: '#3a2b63',
  buildingNear: '#241a3d',
  windowLit: '#ffd166',
  windowDark: '#4a3f6b',
  sidewalk: '#8d7d6b',
  sidewalkEdge: '#6b5d4f',
  asphalt: '#33313d',
  asphaltEdge: '#f5f0e6',
  laneDash: '#ffe9a8',
  grass: '#3f7d4e',
  bikeGreen: '#22c55e', // jaket ojol hijau
  helmet: '#facc15',
  text: '#fff8ec',
  muted: '#ffd9a0',
  panel: 'rgba(20, 12, 40, 0.82)',
  coin: '#f2c94c',
  danger: '#ef4444',
  ok: '#22c55e',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'ojek-rush.best.rp';

/** Funny passenger names and where they are going. */
export const PASSENGERS = [
  { name: 'Mbak Sari', dest: 'Kondangan di Depok', line: 'Buruan, Bang! Kondangannya jam 7!' },
  { name: 'Pak RT', dest: 'Balai Warga', line: 'Rapat RT, jangan telat!' },
  { name: 'Mas Budi', dest: 'Stasiun Gambir', line: 'Kereta jam 8, Bang! Ngebut dikit!' },
  { name: 'Bu Tini', dest: 'Pasar Senen', line: 'Cabainya jangan ketinggalan, ya.' },
  { name: 'Dek Rani', dest: 'Kampus UI', line: 'Ujian jam 9, Bang, tolongg...' },
  { name: 'Om Jono', dest: 'Lapangan Futsal', line: 'Temen-temen udah nungguin!' },
  { name: 'Kak Putri', dest: 'Mall Kota Kasablanka', line: 'Diskonnya habis jam 9, Bang!' },
  { name: 'Bang Bejo', dest: 'Pangkalan Ojek', line: 'Antarin balik ke pangkalan, Bang.' },
];

export const BILLBOARDS = [
  'SATE AYAM 10RB',
  'KOPI HITAM — NGANTUK HILANG',
  'JANGAN NGEBUT, SAYANG',
  'ES TEH JUMBO 5RB',
  'TAMBAL BAN 24 JAM',
  'NASI PADANG MURAH MERIAH',
];

export const CRASH_QUIPS = [
  'ADUH! Helm lecet!',
  'Lubang segede gaban!',
  'Angkotnya ngerem mendadak!',
  'Bajajnya belok seenaknya!',
  'Astagaa... spion patah!',
];

export const NEAR_MISS_QUIPS = ['Wush! Nyaris!', 'Hampir aja!', 'Serem amat!'];
