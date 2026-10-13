/**
 * カーソル下のカードを光らせ、マウスカーソルの形を変える。Updatable。
 */
export class HoverHighlighter {
  constructor({ pointer, picker, field, isEnabled, cursorTarget }) {
    this.pointer = pointer;
    this.picker = picker;
    this.field = field;
    this.isEnabled = isEnabled;
    this.cursorTarget = cursorTarget;
  }

  update() {
    const active = this.isEnabled() && this.pointer.isInside && !this.pointer.isDragging;
    const view = active ? this.picker.pick(this.pointer.ndc) : null;
    this.field.setHovered(view);
    this.cursorTarget.style.cursor = view ? 'pointer' : (this.pointer.isDragging ? 'grabbing' : 'default');
  }
}
