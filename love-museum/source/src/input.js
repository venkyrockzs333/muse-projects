// Input: keyboard + floating touch joystick + drag-to-look.
// Pointer lifecycle rules that the old fixed joystick got wrong:
//  - joystick and look are tracked by separate pointerIds (multitouch)
//  - pointercancel / lostpointercapture / blur / visibilitychange all reset
//  - joystick base is created where the finger lands (left half), knob is
//    clamped to a radius, dead-zone remapped, and it resets instantly
//    on release — no GSAP tween holding stale input after lift-off.
//  - tap is only a tap if the pointer barely moved and lifted quickly.
import { normalizeInput } from './lib.js';

export class Input {
  constructor(joyBaseEl, joyKnobEl) {
    this.keys = {};
    this.joy = { x: 0, y: 0, mag: 0, id: null, cx: 0, cy: 0 };
    this.lookId = null; this.lookX = 0; this.lookY = 0;
    this.lookDX = 0; this.lookDY = 0;
    this.tap = null; // {x,y} set on a clean tap, consumed by main
    this.onTap = null; this.onInteract = null; this.onEscape = null;
    this.joyBaseEl = joyBaseEl; this.joyKnobEl = joyKnobEl;
    this.R = 56;
    this._bind();
  }
  _isUI(e) {
    const t = e.target;
    return t && (t.closest && t.closest('button, input, a, .modal, .pill, .round'));
  }
  _bind() {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyE' && this.onInteract) this.onInteract();
      if (e.code === 'Escape' && this.onEscape) this.onEscape();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => this.resetAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.resetAll(); });

    const down = (e) => {
      if (this._isUI(e)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Left half = joystick (touch) or look-drag start (mouse handled as look on right too)
      if (e.clientX < innerWidth * 0.55 && this.joy.id === null && e.pointerType !== 'mouse') {
        this.joy.id = e.pointerId;
        this.joy.cx = e.clientX; this.joy.cy = e.clientY;
        this.joy.startX = e.clientX; this.joy.startY = e.clientY; this.joy.moved = false; this.joy.startT = performance.now();
        this.joyBaseEl.style.display = 'block';
        this.joyBaseEl.style.left = (e.clientX - 68) + 'px';
        this.joyBaseEl.style.top = (e.clientY - 68) + 'px';
        this.joyBaseEl.classList.add('active');
        try { document.body.setPointerCapture(e.pointerId); } catch (_) {}
      } else if (this.lookId === null) {
        this.lookId = e.pointerId; this.lookX = e.clientX; this.lookY = e.clientY;
        this.lookStartX = e.clientX; this.lookStartY = e.clientY; this.lookMoved = false; this.lookT = performance.now();
        try { document.body.setPointerCapture(e.pointerId); } catch (_) {}
      }
      e.preventDefault();
    };
    const move = (e) => {
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy;
        const len = Math.hypot(dx, dy);
        if (len > this.R) { dx *= this.R / len; dy *= this.R / len; }
        if (Math.hypot(e.clientX - this.joy.startX, e.clientY - this.joy.startY) > 10) this.joy.moved = true;
        const n = normalizeInput(dx / this.R, dy / this.R, 0.18);
        this.joy.x = n.x; this.joy.y = n.y; this.joy.mag = n.mag;
        this.joyKnobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (e.pointerId === this.lookId) {
        const dx = e.clientX - this.lookX, dy = e.clientY - this.lookY;
        this.lookX = e.clientX; this.lookY = e.clientY;
        if (Math.hypot(e.clientX - this.lookStartX, e.clientY - this.lookStartY) > 8) this.lookMoved = true;
        if (this.lookMoved) { this.lookDX += dx; this.lookDY += dy; }
      }
    };
    const up = (e) => {
      if (e.pointerId === this.joy.id) {
        const wasTap = !this.joy.moved && performance.now() - (this.joy.startT || 0) < 450;
        const x = this.joy.startX, y = this.joy.startY;
        this._resetJoy();
        if (wasTap && this.onTap) this.onTap(x, y);
      } else if (e.pointerId === this.lookId) {
        const wasTap = !this.lookMoved && performance.now() - this.lookT < 450;
        const x = this.lookStartX, y = this.lookStartY;
        this.lookId = null; this.lookDX = 0; this.lookDY = 0;
        if (wasTap && this.onTap) this.onTap(x, y);
      }
    };
    const cancel = (e) => {
      if (e.pointerId === this.joy.id) this._resetJoy();
      if (e.pointerId === this.lookId) { this.lookId = null; this.lookDX = 0; this.lookDY = 0; }
    };
    document.addEventListener('pointerdown', down, { passive: false });
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('lostpointercapture', cancel);
  }
  _resetJoy() {
    this.joy.id = null; this.joy.x = 0; this.joy.y = 0; this.joy.mag = 0;
    this.joyKnobEl.style.transform = 'translate(0px, 0px)';
    this.joyBaseEl.style.display = 'none';
    this.joyBaseEl.classList.remove('active');
  }
  resetAll() {
    this.keys = {}; this._resetJoy();
    this.lookId = null; this.lookDX = 0; this.lookDY = 0;
  }
  // Combined keyboard + joystick vector, already normalized.
  moveVector() {
    let ix = this.joy.x, iy = this.joy.y;
    const k = this.keys;
    if (k.KeyD || k.ArrowRight) ix += 1;
    if (k.KeyA || k.ArrowLeft) ix -= 1;
    if (k.KeyS || k.ArrowDown) iy += 1;
    if (k.KeyW || k.ArrowUp) iy -= 1;
    // Note: screen-y down = backward in our mapping below; joy.y already
    // follows the same convention (down = +y = backward).
    const n = normalizeInput(ix, iy, 0.0);
    // Keyboard alone should be full speed; normalizeInput with dead 0
    // already clamps the length to 1.
    return n;
  }
  running() {
    return !!(this.keys.ShiftLeft || this.keys.ShiftRight || this.joy.mag > 0.88);
  }
  consumeLook() {
    const dx = this.lookDX, dy = this.lookDY;
    this.lookDX = 0; this.lookDY = 0;
    return { dx, dy };
  }
}
