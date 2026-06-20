// ============================================================
// INPUT — owns all raw device state.
// Game systems call Input.held(action) / Input.consumePress(action)
// Action mapping lives here — change it without touching game code.
// ============================================================

export const Input = {
  // --- Action → key mapping ---
  _map: {
    up:    ['w', 'arrowup'],
    down:  ['s', 'arrowdown'],
    left:  ['a', 'arrowleft'],
    right: ['d', 'arrowright'],
    q:     ['q'],
    e:     ['e'],
    r:     ['r'],
    shift: ['shift'],
    fire:  ['__mouse0__'],       // left mouse button
    pause: ['p', 'escape'],
    debug:    ['b'],
    aimMode:  [' '],
  },

  _held:    {},     // currently held keys
  _pressed: {},     // pressed this frame (consumed on read)

  mouseScreen: { x: 0, y: 0 },
  mouseWorld:  { x: 0, y: 0 }, // set by Renderer each frame

  init() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this._held[k]) this._pressed[k] = true;
      this._held[k] = true;
      // Prevent default scroll on arrows / space
      if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) { e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      this._held[e.key.toLowerCase()] = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouseScreen.x = e.clientX;
      this.mouseScreen.y = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        if (!this._held['__mouse0__']) this._pressed['__mouse0__'] = true;
        this._held['__mouse0__'] = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._held['__mouse0__'] = false;
    });
  },

  // True while any mapped key for action is held
  held(...actions) {
    return actions.some(action =>
      (this._map[action] ?? [action]).some(k => this._held[k])
    );
  },

  // True once per key-down event (consumed after read)
  consumePress(action) {
    const keys = this._map[action] ?? [action];
    for (const k of keys) {
      if (this._pressed[k]) { this._pressed[k] = false; return true; }
    }
    return false;
  },

  // Clear pressed state at end of frame
  clearPressed() { this._pressed = {}; },
};
