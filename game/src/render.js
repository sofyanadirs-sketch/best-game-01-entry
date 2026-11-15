// Ojek Rush renderer: every pixel is drawn in code on one canvas — a Jakarta dusk,
// Monas on the skyline, warung stalls and billboards at the roadside, and a green
// jacket ojek weaving through traffic. The playfield is a fixed 1280x720 logical
// area scaled to the window.
import { FIELD, ROAD, LANES, PALETTE, FONT, PASSENGERS, BILLBOARDS, DELIVERIES_TO_WIN, SHIFT_SECONDS } from './config.js';
import { KIND_CAR, KIND_BAJAJ, KIND_ANGKOT, KIND_TRUCK, KIND_POTHOLE, KIND_COIN, KIND_PASSENGER, KIND_GATE } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function rp(n) {
  return `Rp${Math.floor(n).toLocaleString('id-ID')}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawSky(state) {
    // Dusk strip at the top; the road fills the rest of the screen.
    const g = ctx.createLinearGradient(0, 0, 0, 150);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, 150);
    // Low sun over the skyline.
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(1050, 88, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
    ctx.beginPath();
    ctx.arc(1050, 88, 60, 0, Math.PI * 2);
    ctx.fill();
    // Drifting clouds.
    ctx.fillStyle = 'rgba(255, 240, 220, 0.75)';
    for (let i = 0; i < 4; i += 1) {
      const cx = ((i * 370 + state.scroll * 0.12) % 1500) - 120;
      const cy = 26 + i * 26;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 62, 14, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 44, cy + 5, 44, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Far skyline with Monas in the middle, sitting on the horizon at y=140.
    ctx.fillStyle = PALETTE.buildingFar;
    const skyline = [50, 80, 40, 95, 60, 85, 50, 105, 70, 45, 90, 65, 100, 55, 75, 45];
    let bx = -20;
    for (const h of skyline) {
      ctx.fillRect(bx, 140 - h, 84, h);
      bx += 84;
    }
    // Monas: obelisk + flame.
    ctx.fillStyle = PALETTE.buildingFar;
    ctx.beginPath();
    ctx.moveTo(618, 140);
    ctx.lineTo(636, 38);
    ctx.lineTo(654, 140);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.ellipse(636, 30, 10, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Near buildings with lit windows, flanking the road below the horizon.
    ctx.fillStyle = PALETTE.buildingNear;
    ctx.fillRect(0, 140, 330, 580);
    ctx.fillRect(950, 140, 330, 580);
    for (let i = 0; i < 48; i += 1) {
      const wx = 18 + (i % 6) * 52 + (i < 24 ? 0 : 950);
      const wy = 160 + Math.floor((i % 24) / 6) * 64 + (i % 3) * 8;
      ctx.fillStyle = i % 3 === 0 ? PALETTE.windowLit : PALETTE.windowDark;
      ctx.fillRect(wx, wy, 30, 34);
    }
    // Grass strips between buildings and sidewalk.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(300, 140, 40, 580);
    ctx.fillRect(940, 140, 40, 580);
  }

  function drawRoad(state) {
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(300, 140, 40, 580);
    ctx.fillRect(940, 140, 40, 580);
    ctx.fillStyle = PALETTE.sidewalkEdge;
    ctx.fillRect(336, 140, 4, 580);
    ctx.fillRect(940, 140, 4, 580);
    // Asphalt.
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(ROAD.left, 140, ROAD.right - ROAD.left, 580);
    ctx.fillStyle = PALETTE.asphaltEdge;
    ctx.fillRect(ROAD.left, 140, 5, 580);
    ctx.fillRect(ROAD.right - 5, 140, 5, 580);
    // Scrolling lane dashes.
    ctx.fillStyle = PALETTE.laneDash;
    const offset = state.scroll % 64;
    for (const lx of [540, 740]) {
      for (let y = 140 - offset; y < FIELD.height; y += 64) {
        ctx.fillRect(lx - 3, y, 6, 34);
      }
    }
    // Zebra crossing, scrolling with the road.
    const zy = 140 + ((state.scroll + 500) % 900);
    if (zy > 140 && zy < FIELD.height - 40) {
      ctx.fillStyle = 'rgba(245, 240, 230, 0.85)';
      for (let x = ROAD.left + 12; x < ROAD.right - 12; x += 34) ctx.fillRect(x, zy, 20, 26);
    }
  }

  function drawDecor(state) {
    for (const d of state.decor) {
      if (d.y < 130 || d.y > FIELD.height + 40) continue;
      if (d.kind === 'tree') {
        ctx.fillStyle = '#2d5a33';
        ctx.beginPath();
        ctx.arc(d.x, d.y, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3f7d4e';
        ctx.beginPath();
        ctx.arc(d.x - 8, d.y - 8, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5d4037';
        ctx.fillRect(d.x - 4, d.y + 14, 8, 22);
      } else if (d.kind === 'stall') {
        ctx.fillStyle = '#b45309';
        roundRect(ctx, d.x - 42, d.y - 10, 84, 46, 6);
        ctx.fill();
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(d.x - 48, d.y - 8);
        ctx.lineTo(d.x + 48, d.y - 8);
        ctx.lineTo(d.x + 38, d.y - 34);
        ctx.lineTo(d.x - 38, d.y - 34);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff8ec';
        ctx.font = 'bold 13px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('WARUNG', d.x, d.y + 18);
      } else if (d.kind === 'billboard') {
        ctx.fillStyle = '#4a3f6b';
        ctx.fillRect(d.x - 3, d.y, 6, 60);
        ctx.fillStyle = '#facc15';
        roundRect(ctx, d.x - 58, d.y - 52, 116, 54, 6);
        ctx.fill();
        ctx.fillStyle = '#7c2d12';
        ctx.font = 'bold 12px ' + FONT;
        ctx.textAlign = 'center';
        const words = (d.text || BILLBOARDS[0]).split(' ');
        ctx.fillText(words.slice(0, 2).join(' '), d.x, d.y - 32);
        ctx.fillText(words.slice(2).join(' ') || 'MURAH!', d.x, d.y - 14);
      }
    }
  }

  function wheels(x, y, w, h, color) {
    ctx.fillStyle = color || '#111';
    const wy = [y - h / 2 + 12, y + h / 2 - 12];
    for (const yy of wy) {
      roundRect(ctx, x - w / 2 - 6, yy - 14, 10, 28, 4);
      ctx.fill();
      roundRect(ctx, x + w / 2 - 4, yy - 14, 10, 28, 4);
      ctx.fill();
    }
  }

  function drawVehicle(e) {
    const x = e.x;
    const y = e.y;
    ctx.save();
    if (e.kind === KIND_CAR) {
      wheels(x, y, e.w, e.h);
      ctx.fillStyle = e.color;
      roundRect(ctx, x - e.w / 2, y - e.h / 2, e.w, e.h, 16);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      roundRect(ctx, x - e.w / 2 + 8, y - e.h / 2 + 26, e.w - 16, 26, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,20,40,0.55)';
      roundRect(ctx, x - e.w / 2 + 10, y - 18, e.w - 20, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x - e.w / 2 + 8, y + e.h / 2 - 12, 16, 6);
      ctx.fillRect(x + e.w / 2 - 24, y + e.h / 2 - 12, 16, 6);
    } else if (e.kind === KIND_BAJAJ) {
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(x, y + e.h / 2 - 6, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      roundRect(ctx, x - e.w / 2, y - e.h / 2, e.w, e.h, 14);
      ctx.fill();
      ctx.fillStyle = '#111827';
      roundRect(ctx, x - e.w / 2 + 6, y - e.h / 2 + 8, e.w - 12, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#fff8ec';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('BAJAJ', x, y + 22);
    } else if (e.kind === KIND_ANGKOT) {
      wheels(x, y, e.w, e.h);
      ctx.fillStyle = '#0ea5e9';
      roundRect(ctx, x - e.w / 2, y - e.h / 2, e.w, e.h, 12);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x - e.w / 2, y - e.h / 2 + 34, e.w, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 3; i += 1) ctx.fillRect(x - e.w / 2 + 10, y - e.h / 2 + 58 + i * 30, e.w - 20, 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('ANGKOT 01', x, y + e.h / 2 - 8);
    } else if (e.kind === KIND_TRUCK) {
      wheels(x, y, e.w, e.h);
      ctx.fillStyle = '#94a3b8';
      roundRect(ctx, x - e.w / 2, y - e.h / 2, e.w, e.h - 52, 6);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      roundRect(ctx, x - e.w / 2, y + e.h / 2 - 58, e.w, 58, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(20,20,40,0.5)';
      roundRect(ctx, x - e.w / 2 + 10, y + e.h / 2 - 50, e.w - 20, 22, 6);
      ctx.fill();
    } else if (e.kind === KIND_POTHOLE) {
      ctx.fillStyle = '#1c1626';
      ctx.beginPath();
      ctx.ellipse(x, y, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f0b18';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - e.w / 2 + 6, y);
      ctx.lineTo(x - 10, y - 6);
      ctx.lineTo(x + 8, y + 4);
      ctx.lineTo(x + e.w / 2 - 8, y - 2);
      ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('AWAS LUBANG!', x, y - e.h / 2 - 6);
    } else if (e.kind === KIND_COIN) {
      const squish = Math.abs(Math.cos(e.wobble));
      ctx.save();
      ctx.translate(x, y + Math.sin(e.wobble) * 3);
      ctx.scale(0.4 + 0.6 * squish, 1);
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.coin;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 11px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('Rp', x, y + 4);
    } else if (e.kind === KIND_PASSENGER) {
      // A waiting passenger, waving at the roadside.
      const wave = Math.sin(e.wobble * 1.4) * 8;
      ctx.fillStyle = '#ff8fab';
      ctx.beginPath();
      ctx.arc(x, y - 26, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b82f6';
      roundRect(ctx, x - 14, y - 14, 28, 40, 8);
      ctx.fill();
      ctx.strokeStyle = '#ff8fab';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + 12, y - 8);
      ctx.lineTo(x + 26, y - 26 + wave);
      ctx.stroke();
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(x - 12, y + 26, 9, 16);
      ctx.fillRect(x + 3, y + 26, 9, 16);
      // Speech bubble with their line.
      const line = (e.info && e.info.line) || 'Bang, ojek!';
      ctx.font = 'bold 13px ' + FONT;
      const tw = ctx.measureText(line).width + 20;
      const bx = Math.min(Math.max(x - tw / 2, 8), FIELD.width - tw - 8);
      ctx.fillStyle = '#fff8ec';
      roundRect(ctx, bx, y - 92, tw, 30, 10);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 62);
      ctx.lineTo(x + 6, y - 62);
      ctx.lineTo(x, y - 48);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7c2d12';
      ctx.textAlign = 'center';
      ctx.fillText(line, bx + tw / 2, y - 72);
    } else if (e.kind === KIND_GATE) {
      // Green destination gate across the lane.
      ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.fillRect(x - e.w / 2, y - e.h / 2, e.w, e.h);
      ctx.fillStyle = PALETTE.ok;
      for (let i = 0; i < 5; i += 1) {
        if (i % 2 === 0) ctx.fillRect(x - e.w / 2 + i * 30, y - e.h / 2, 30, 14);
        else ctx.fillRect(x - e.w / 2 + i * 30, y + e.h / 2 - 14, 30, 14);
      }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('★ TUJUAN ★', x, y + 5);
    }
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    const x = p.x;
    const y = p.y;
    const blink = state.invulnerable > 0 && Math.floor(state.time * 12) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    const lean = (p.targetX - p.x) * 0.0012;
    ctx.translate(x, y);
    ctx.rotate(lean);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(4, 34, 34, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Bike: wheels, body, headlight.
    ctx.fillStyle = '#111827';
    roundRect(ctx, -10, -46, 20, 18, 8);
    ctx.fill();
    roundRect(ctx, -10, 30, 20, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    roundRect(ctx, -16, -30, 32, 66, 12);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, -13, -8, 26, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(0, -46, 6, 0, Math.PI * 2);
    ctx.fill();
    // Passenger riding pillion, if any.
    if (state.passengerPhase === 'carrying') {
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.arc(0, 26, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 26, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f472b6';
      roundRect(ctx, -13, 34, 26, 16, 7);
      ctx.fill();
    }
    // Driver: green jacket, yellow helmet.
    ctx.fillStyle = PALETTE.bikeGreen;
    roundRect(ctx, -15, -6, 30, 30, 10);
    ctx.fill();
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -18, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-14, -20, 28, 7);
    // Arms to the handlebar.
    ctx.strokeStyle = PALETTE.bikeGreen;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-12, 2);
    ctx.lineTo(-14, -34);
    ctx.moveTo(12, 2);
    ctx.lineTo(14, -34);
    ctx.stroke();
    ctx.restore();
    // "BANG UDIN" name tag.
    ctx.fillStyle = '#fff8ec';
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('BANG UDIN • BEAT KARBU', x, y + 58);
  }

  function drawDestinationArrow(state) {
    // A yellow arrow marks the waiting passenger's lane; a green one marks
    // the destination gate while carrying, so the player can line up early.
    if (state.passengerPhase === 'waiting' && state.passenger) {
      const laneX = LANES[state.passenger.lane];
      const bob = Math.sin(state.time * 5) * 4;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(laneX, 152 + bob);
      ctx.lineTo(laneX - 15, 128 + bob);
      ctx.lineTo(laneX - 6, 128 + bob);
      ctx.lineTo(laneX - 6, 114 + bob);
      ctx.lineTo(laneX + 6, 114 + bob);
      ctx.lineTo(laneX + 6, 128 + bob);
      ctx.lineTo(laneX + 15, 128 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('PENUMPANG ↓', laneX, 110 + bob);
      return;
    }
    if (state.passengerPhase !== 'carrying' || !state.gate) return;
    const laneX = LANES[state.gate.lane];
    const bob = Math.sin(state.time * 5) * 4;
    ctx.fillStyle = PALETTE.ok;
    ctx.beginPath();
    ctx.moveTo(laneX, 152 + bob);
    ctx.lineTo(laneX - 15, 128 + bob);
    ctx.lineTo(laneX - 6, 128 + bob);
    ctx.lineTo(laneX - 6, 114 + bob);
    ctx.lineTo(laneX + 6, 114 + bob);
    ctx.lineTo(laneX + 6, 128 + bob);
    ctx.lineTo(laneX + 15, 128 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('TUJUAN ↓', laneX, 110 + bob);
  }

  function drawHud(state, best) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 12, 10, FIELD.width - 24, 64, 12);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.coin;
    ctx.font = 'bold 30px ' + FONT;
    ctx.fillText(rp(state.score), 28, 50);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 14px ' + FONT;
    ctx.fillText('ARGO', 28, 28);
    // Deliveries.
    ctx.fillStyle = '#fff8ec';
    ctx.font = 'bold 20px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(`🛵 Penumpang ${state.deliveries}/${DELIVERIES_TO_WIN}`, 640, 42);
    if (state.combo > 1) {
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillText(`🔥 Kombo x${state.combo} tanpa nabrak!`, 640, 64);
    }
    // Timer.
    const t = Math.max(0, Math.ceil(state.shiftLeft));
    const mm = Math.floor(t / 60);
    const ss = String(t % 60).padStart(2, '0');
    ctx.fillStyle = t <= 10 ? '#f87171' : '#fff8ec';
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText(`⏱ ${mm}:${ss}`, 1256, 48);
    // Helmets = lives.
    ctx.textAlign = 'right';
    ctx.font = '20px ' + FONT;
    let helmets = '';
    for (let i = 0; i < 3; i += 1) helmets += i < state.lives ? '🪖' : '💥';
    ctx.fillText(helmets, 1120, 48);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(`Level ${state.level} — makin macet!`, 1120, 66);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px ' + FONT;
    ctx.fillText(`Terbaik: ${rp(best)}`, 28, 68);
    // Patience bar while carrying a passenger.
    if (state.passengerPhase === 'carrying') {
      const w = 260;
      const frac = Math.max(0, state.patience / 25);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, 510, 82, w, 18, 9);
      ctx.fill();
      ctx.fillStyle = frac > 0.4 ? PALETTE.ok : '#ef4444';
      roundRect(ctx, 512, 84, (w - 4) * frac, 14, 7);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(`Penumpang sabar: ${Math.ceil(state.patience)} dtk`, 640, 95);
    }
    // Quip banner at the bottom.
    if (state.quip && state.time < state.quipUntil) {
      ctx.font = 'bold 18px ' + FONT;
      const tw = ctx.measureText(state.quip).width + 32;
      ctx.fillStyle = 'rgba(20, 12, 40, 0.85)';
      roundRect(ctx, (FIELD.width - tw) / 2, FIELD.height - 52, tw, 36, 12);
      ctx.fill();
      ctx.fillStyle = '#fff8ec';
      ctx.textAlign = 'center';
      ctx.fillText(state.quip, FIELD.width / 2, FIELD.height - 28);
    }
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = 'rgba(10, 6, 24, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const w = 760;
    const h = 120 + lines.length * 34;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.coin;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();
    ctx.fillStyle = accent || PALETTE.coin;
    ctx.font = 'bold 44px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(title, FIELD.width / 2, y + 62);
    ctx.fillStyle = '#fff8ec';
    ctx.font = '20px ' + FONT;
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, y + 108 + i * 34);
    });
  }

  function draw(state, screen, best, won) {
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    const ox = (canvas.width - FIELD.width * scale) / 2;
    const oy = (canvas.height - FIELD.height * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14102a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake * 24, (Math.random() - 0.5) * state.shake * 24);
    }
    drawSky(state);
    drawRoad(state);
    // Roadside life and traffic slide in from behind the horizon: clip them
    // to the road area so nothing pops up over the sky.
    ctx.save();
    ctx.beginPath();
    ctx.rect(300, 140, 680, FIELD.height - 140);
    ctx.clip();
    drawDecor(state);
    for (const e of state.entities) if (e.active) drawVehicle(e);
    ctx.restore();
    drawPlayer(state);
    drawDestinationArrow(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
    if (screen === SCREEN_TITLE) {
      panel('🛵 OJEK RUSH', [
        'Jadi Bang Udin, driver ojek paling ngebut se-Jakarta!',
        'Jemput penumpang, antar sampai TUJUAN sebelum dia ngambek.',
        'Antar 5 penumpang dalam 90 detik — nabrak 3x, shift bubar.',
        '',
        '← → / A D  ganti jalur    ↑ gas    ↓ rem    Spasi mulai    P jeda',
        'Koin Rp2.000  •  Antar Rp15.000  •  Nyaris nabrak +Rp500',
        `Terbaik: ${rp(best)} — klik atau tekan Spasi untuk mulai!`,
      ], PALETTE.bikeGreen);
    } else if (screen === SCREEN_PAUSED) {
      panel('⏸ JEDA DULU, BANG', [
        'Ngopi dulu, macetnya nggak ke mana-mana.',
        'Tekan P atau Spasi untuk lanjut narik.',
      ], PALETTE.muted);
    } else if (screen === SCREEN_OVER) {
      if (won) {
        panel('🏆 SHIFT SELESAI!', [
          `5 penumpang sampai tujuan. Total argo: ${rp(state.score)}`,
          `Terbaik: ${rp(best)} — Bang Udin memang legenda jalanan!`,
          'Tekan Spasi / klik untuk narik lagi.',
        ], PALETTE.ok);
      } else {
        const reason = state.lives <= 0 ? 'Motornya remuk, 3x nabrak!' : 'Shift habis, penumpang masih nungguin!';
        panel('💥 SHIFT BUBAR!', [
          reason,
          `Penumpang terantar: ${state.deliveries}/${DELIVERIES_TO_WIN}  •  Argo: ${rp(state.score)}`,
          `Terbaik: ${rp(best)} — coba lagi, Bang!`,
          'Tekan Spasi / klik untuk narik lagi.',
        ], '#ef4444');
      }
    }
  }

  return { draw, resize };
}
