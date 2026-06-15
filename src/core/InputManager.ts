// Singleton that tracks raw keyboard and mouse state each frame.
// Systems read from this rather than attaching their own event listeners.
export class InputManager {
  private static instance: InputManager

  private keys = new Set<string>()
  private keysJustPressed = new Set<string>()
  private keysJustReleased = new Set<string>()

  mouseDeltaX = 0
  mouseDeltaY = 0
  mouseButtons = new Set<number>()
  mouseButtonsJustPressed = new Set<number>()

  private constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.keysJustPressed.add(e.code)
      this.keys.add(e.code)
      // Prevent browser shortcuts from stealing focus during play
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code)
      this.keysJustReleased.add(e.code)
    })
    window.addEventListener('mousemove', (e) => {
      this.mouseDeltaX += e.movementX
      this.mouseDeltaY += e.movementY
    })
    window.addEventListener('mousedown', (e) => {
      if (!this.mouseButtons.has(e.button)) this.mouseButtonsJustPressed.add(e.button)
      this.mouseButtons.add(e.button)
    })
    window.addEventListener('mouseup', (e) => {
      this.mouseButtons.delete(e.button)
    })
  }

  static getInstance(): InputManager {
    if (!InputManager.instance) InputManager.instance = new InputManager()
    return InputManager.instance
  }

  isDown(code: string): boolean { return this.keys.has(code) }
  justPressed(code: string): boolean { return this.keysJustPressed.has(code) }
  justReleased(code: string): boolean { return this.keysJustReleased.has(code) }
  mouseDown(button: number): boolean { return this.mouseButtons.has(button) }
  mouseJustPressed(button: number): boolean { return this.mouseButtonsJustPressed.has(button) }

  // Call once per frame AFTER all systems have read input.
  flushFrame(): void {
    this.keysJustPressed.clear()
    this.keysJustReleased.clear()
    this.mouseButtonsJustPressed.clear()
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
  }
}
