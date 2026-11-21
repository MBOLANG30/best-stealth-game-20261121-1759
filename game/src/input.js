// input.js — keyboard and mouse, kept in one place so the game loop and
// the autopilot both speak the same language: plain booleans and a point.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.up = false;
    this.down = false;
    this.left = false;
    this.right = false;
    this.sneak = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseInCanvas = false;
    this.clicked = false; // a click waiting to be consumed (coin toss)
    this.clickX = 0;
    this.clickY = 0;
    this.coinToss = null; // a requested coin toss {x, y}, consumed by the game
    this.pressedKeys = new Set(); // edge-triggered keys, consumed by the game
    this.attach();
  }

  attach() {
    window.addEventListener('keydown', (e) => {
      if (this.isGameKey(e.code)) e.preventDefault();
      this.pressedKeys.add(e.code);
      this.updateKey(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      this.updateKey(e.code, false);
    });
    window.addEventListener('blur', () => {
      this.up = this.down = this.left = this.right = this.sneak = false;
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouseY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      this.mouseInCanvas = true;
    });
    this.canvas.addEventListener('mouseleave', () => {
      this.mouseInCanvas = false;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.clickX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      this.clickY = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      this.clicked = true;
    });
  }

  isGameKey(code) {
    return (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    );
  }

  updateKey(code, down) {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        this.up = down;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.down = down;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.left = down;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.right = down;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.sneak = down;
        break;
      default:
        break;
    }
  }

  // Did this key go down since the last check? (Enter, R, P, E, Escape…)
  wasPressed(code) {
    if (this.pressedKeys.has(code)) {
      this.pressedKeys.delete(code);
      return true;
    }
    return false;
  }

  consumeClick() {
    if (!this.clicked) return null;
    this.clicked = false;
    return { x: this.clickX, y: this.clickY };
  }

  clearPresses() {
    this.pressedKeys.clear();
    this.clicked = false;
  }
}
