// Keyboard + mouse input. Arrow keys / WASD steer, Space confirms, P pauses.
// Clicking the left or right half of the road changes lane; any click confirms
// on the title and game-over screens.
export const ACTION_CONFIRM = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_LEFT = 1 << 2;
export const ACTION_RIGHT = 1 << 3;

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let laneQueue = 0;

  function keyOf(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  function onKeyDown(e) {
    const k = keyOf(e);
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    held.add(k);
    if (k === ' ' || k === 'Enter') actions |= ACTION_CONFIRM;
    if (k === 'p' || k === 'P' || k === 'Escape') actions |= ACTION_PAUSE;
    if (k === 'ArrowLeft' || k === 'a') laneQueue -= 1;
    if (k === 'ArrowRight' || k === 'd') laneQueue += 1;
  }

  function onKeyUp(e) {
    held.delete(keyOf(e));
  }

  function onPointer(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.5) laneQueue -= 1;
    else laneQueue += 1;
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointer);

  function direction() {
    const d = Math.max(-1, Math.min(1, laneQueue));
    laneQueue = 0;
    return d;
  }

  function gas() {
    return held.has('ArrowUp') || held.has('w');
  }

  function brake() {
    return held.has('ArrowDown') || held.has('s');
  }

  function takeActions() {
    const out = actions;
    actions = 0;
    return out;
  }

  return { direction, gas, brake, takeActions };
}
