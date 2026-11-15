// Tiny WebAudio bleeps for Ojek Rush — coin ding, pickup chime, delivery fanfare,
// crash thud and a honk. Synthesised, no audio files, no network. Sound starts
// only after the first user gesture, as browsers require.
export function createAudio() {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    const ac = ensure();
    if (!ac || !enabled) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock() {
      ensure();
    },
    coin() {
      tone(988, 0.09, 'sine', 0.1);
      tone(1319, 0.14, 'sine', 0.1, 0.07);
    },
    pickup() {
      tone(523, 0.1, 'triangle', 0.12);
      tone(659, 0.1, 'triangle', 0.12, 0.09);
      tone(784, 0.16, 'triangle', 0.12, 0.18);
    },
    deliver() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.13, i * 0.09));
    },
    crash() {
      tone(160, 0.3, 'sawtooth', 0.16, 0, 50);
      tone(90, 0.25, 'square', 0.1, 0.02, 40);
    },
    honk() {
      tone(370, 0.12, 'square', 0.06);
      tone(370, 0.12, 'square', 0.06, 0.16);
    },
    toggle() {
      enabled = !enabled;
      return enabled;
    },
  };
}
