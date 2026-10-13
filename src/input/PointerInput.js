import { EventEmitter } from '../core/EventEmitter.js';

export const PointerInputEvent = Object.freeze({
  Tap: 'tap',   // payload: { x, y }（NDC）
  Drag: 'drag'  // payload: { dx, dy }（px）
});

/**
 * マウス・タッチ入力を「タップ」と「ドラッグ」に分類して通知する。
 * 現在のカーソル位置（NDC）と、要素の上にあるか・ドラッグ中かも保持する。
 */
export class PointerInput extends EventEmitter {
  #down = null;

  constructor(element, { dragThresholdPx }) {
    super();
    this.element = element;
    this.dragThreshold = dragThresholdPx;
    this.ndc = { x: 0, y: -0.05 };
    this.isInside = false;
    element.addEventListener('pointerdown', this.#onDown);
    element.addEventListener('pointermove', this.#onMove);
    element.addEventListener('pointerup', this.#onUp);
    element.addEventListener('pointercancel', this.#onCancel);
    element.addEventListener('pointerleave', () => { this.isInside = false; });
    element.addEventListener('contextmenu', e => e.preventDefault());
  }

  get isDragging() { return this.#down?.dragging === true; }

  #updateNdc(e) {
    const r = this.element.getBoundingClientRect();
    this.ndc = {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: -((e.clientY - r.top) / r.height) * 2 + 1
    };
    this.isInside = true;
  }

  #onDown = (e) => {
    this.#updateNdc(e);
    this.#down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, button: e.button, dragging: false };
    this.element.setPointerCapture?.(e.pointerId);
  };

  #onMove = (e) => {
    this.#updateNdc(e);
    const d = this.#down;
    if (!d) return;
    if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > this.dragThreshold) d.dragging = true;
    if (d.dragging) this.emit(PointerInputEvent.Drag, { dx: e.clientX - d.lastX, dy: e.clientY - d.lastY });
    d.lastX = e.clientX;
    d.lastY = e.clientY;
  };

  #onUp = (e) => {
    const d = this.#down;
    this.#down = null;
    if (!d) return;
    this.#updateNdc(e);
    if (!d.dragging && d.button === 0) this.emit(PointerInputEvent.Tap, { ...this.ndc });
  };

  #onCancel = () => {
    this.#down = null;
  };
}
