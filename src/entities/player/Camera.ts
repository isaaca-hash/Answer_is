import * as THREE from 'three'
import type { InputManager } from '../../core/InputManager'
import { useGameStore } from '../../ui/store'

const PITCH_LIMIT = Math.PI / 2 - 0.01 // ~89.4° — prevent gimbal lock

// Wraps PerspectiveCamera + PointerLock API.
// Yaw rotates the Object3D (parent), pitch rotates the camera directly.
// This separation lets Movement drive horizontal position via the Object3D.
export class FPSCamera {
  readonly object: THREE.Object3D  // moved by Movement
  readonly camera: THREE.PerspectiveCamera

  private yaw = 0
  private pitch = 0
  private locked = false

  constructor(canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.05, 500)
    this.camera.position.set(0, 1.7, 0) // eye height

    this.object = new THREE.Object3D()
    this.object.add(this.camera)

    // Request pointer lock on click
    canvas.addEventListener('click', () => {
      if (!this.locked) canvas.requestPointerLock()
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas
    })
  }

  get isLocked(): boolean { return this.locked }

  update(input: InputManager, _dt: number): void {
    if (!this.locked) return

    const sensitivity = useGameStore.getState().sensitivity
    this.yaw   -= input.mouseDeltaX * sensitivity
    this.pitch -= input.mouseDeltaY * sensitivity
    this.pitch  = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch))

    this.object.rotation.y = this.yaw
    this.camera.rotation.x = this.pitch
  }

  // Forward direction projected onto the XZ plane (for movement)
  getForwardXZ(): THREE.Vector3 {
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    dir.y = 0
    return dir.normalize()
  }

  getRightXZ(): THREE.Vector3 {
    const fwd = this.getForwardXZ()
    return new THREE.Vector3(fwd.z, 0, -fwd.x)
  }

  getWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3()
    this.camera.getWorldPosition(pos)
    return pos
  }

  getWorldDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3()
    this.camera.getWorldDirection(dir)
    return dir
  }

  setFOV(fov: number): void {
    this.camera.fov = fov
    this.camera.updateProjectionMatrix()
  }

  // Apply a recoil kick — smoothed by Movement's camera update
  applyRecoil(amount: number): void {
    this.pitch += amount
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch))
    this.camera.rotation.x = this.pitch
  }

  dispose(): void {
    document.exitPointerLock()
  }
}
