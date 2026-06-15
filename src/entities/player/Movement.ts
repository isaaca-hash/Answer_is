import * as THREE from 'three'
import type { FPSCamera } from './Camera'
import type { InputManager } from '../../core/InputManager'
import { useGameStore } from '../../ui/store'

const WALK_SPEED   = 7
const DASH_SPEED   = 12
const JUMP_VELOCITY = 4.2   // yields ~0.5m height under gravity 9.8
const GRAVITY      = 20
const PLAYER_HEIGHT = 1.8   // full capsule height
const EYE_OFFSET   = 1.7    // camera Y from floor
const PLAYER_RADIUS = 0.4

// Dash stamina: max 10 units, costs 1 per second dashing, recovers 1 per 1.5s idle
const DASH_MAX      = 10
const DASH_COST     = 1       // per second
const DASH_RECOVER  = 1 / 1.5 // per second

export class Movement {
  private cam: FPSCamera
  private input: InputManager

  private position = new THREE.Vector3(0, 0, 0)
  private velocity = new THREE.Vector3()
  private onGround = false
  private dashStamina = DASH_MAX

  constructor(cam: FPSCamera, input: InputManager) {
    this.cam = cam
    this.input = input
    // Sync the camera object's position immediately
    this.cam.object.position.copy(this.position)
  }

  getPosition(): THREE.Vector3 { return this.position.clone() }
  getDashStamina(): number { return this.dashStamina }
  getMaxDashStamina(): number { return DASH_MAX }

  update(dt: number, colliders: THREE.Box3[]): void {
    const store   = useGameStore.getState()
    const stunned = store.stunTimer > 0
    const speedPenalty = store.armor?.speedPenalty ?? 0
    const isDashing = !stunned && this.input.isDown('ShiftLeft') && this.dashStamina > 0
    const speed = isDashing ? DASH_SPEED : WALK_SPEED * (1 - speedPenalty)

    // Manage dash stamina
    if (isDashing) {
      this.dashStamina = Math.max(0, this.dashStamina - DASH_COST * dt)
    } else {
      this.dashStamina = Math.min(DASH_MAX, this.dashStamina + DASH_RECOVER * dt)
    }

    const fwd    = this.cam.getForwardXZ()
    const right  = this.cam.getRightXZ()
    const moveDir = new THREE.Vector3()

    if (!stunned) {
      if (this.input.isDown('KeyW')) moveDir.add(fwd)
      if (this.input.isDown('KeyS')) moveDir.sub(fwd)
      if (this.input.isDown('KeyD')) moveDir.add(right)
      if (this.input.isDown('KeyA')) moveDir.sub(right)
    }
    if (moveDir.lengthSq() > 0) moveDir.normalize()

    this.velocity.x = moveDir.x * speed
    this.velocity.z = moveDir.z * speed

    if (!stunned && this.input.justPressed('Space') && this.onGround) {
      this.velocity.y = JUMP_VELOCITY
      this.onGround = false
    }

    // Gravity
    if (!this.onGround) {
      this.velocity.y -= GRAVITY * dt
    }

    // Integrate position
    const delta = this.velocity.clone().multiplyScalar(dt)
    this.position.add(delta)

    // Floor collision
    if (this.position.y < 0) {
      this.position.y = 0
      this.velocity.y = 0
      this.onGround = true
    }

    // Simple AABB wall collision
    this.resolveColliders(colliders)

    // Push camera object to new position
    this.cam.object.position.set(this.position.x, this.position.y + EYE_OFFSET - PLAYER_HEIGHT / 2, this.position.z)
  }

  private resolveColliders(colliders: THREE.Box3[]): void {
    const playerBox = new THREE.Box3(
      new THREE.Vector3(
        this.position.x - PLAYER_RADIUS,
        this.position.y,
        this.position.z - PLAYER_RADIUS,
      ),
      new THREE.Vector3(
        this.position.x + PLAYER_RADIUS,
        this.position.y + PLAYER_HEIGHT,
        this.position.z + PLAYER_RADIUS,
      ),
    )

    for (const wall of colliders) {
      if (!playerBox.intersectsBox(wall)) continue

      // Push player out on the shallowest axis
      const wallCenter = new THREE.Vector3()
      wall.getCenter(wallCenter)
      const dx = this.position.x - wallCenter.x
      const dz = this.position.z - wallCenter.z
      const wallHalfX = (wall.max.x - wall.min.x) / 2 + PLAYER_RADIUS
      const wallHalfZ = (wall.max.z - wall.min.z) / 2 + PLAYER_RADIUS
      const overlapX = wallHalfX - Math.abs(dx)
      const overlapZ = wallHalfZ - Math.abs(dz)

      if (overlapX < overlapZ) {
        this.position.x += overlapX * Math.sign(dx)
        this.velocity.x = 0
      } else {
        this.position.z += overlapZ * Math.sign(dz)
        this.velocity.z = 0
      }
    }
  }
}
