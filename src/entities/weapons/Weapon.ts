import * as THREE from 'three'
import type { WeaponDef } from '../../types/weapon.types'
import type { InputManager } from '../../core/InputManager'

export interface HitResult {
  point: THREE.Vector3
  normal: THREE.Vector3
  damage: number              // raw base × upgrades (headshot NOT applied)
  headshotMultiplier: number  // from weapon def
  isHeadshot: boolean
  distance: number
}

// Abstract base — concrete weapons override update().
// Returns HitResult[] so multi-hit weapons (shotgun spread, sniper penetration) work naturally.
export abstract class Weapon {
  protected def: WeaponDef
  protected camera: THREE.PerspectiveCamera
  protected scene: THREE.Scene
  protected input: InputManager

  currentAmmo: number
  reserveAmmo: number
  isReloading = false
  protected reloadTimer = 0
  protected fireTimer   = 0

  // Applied by EconomySystem after upgrades are purchased
  upgradeMultiplier    = 1.0   // damage multiplier
  reloadSpeedMult      = 1.0   // < 1 = faster reload (multiplied into reload_time)
  magBonus             = 0     // extra rounds per mag
  recoilMult           = 1.0   // < 1 = reduced recoil

  get id(): string { return this.def.id }

  protected raycaster = new THREE.Raycaster()

  constructor(def: WeaponDef, camera: THREE.PerspectiveCamera, scene: THREE.Scene, input: InputManager) {
    this.def        = def
    this.camera     = camera
    this.scene      = scene
    this.input      = input
    this.currentAmmo = def.mag_size
    this.reserveAmmo = def.mag_size * (def.starting_mags - 1)
  }

  get effectiveMagSize(): number { return this.def.mag_size + this.magBonus }
  get maxReserve(): number       { return this.effectiveMagSize * this.def.max_mags }
  get isOutOfAmmo(): boolean     { return this.currentAmmo === 0 && this.reserveAmmo === 0 }

  abstract update(dt: number): HitResult[]

  protected startReload(): void {
    if (this.isReloading) return
    if (this.reserveAmmo <= 0) return
    if (this.currentAmmo >= this.effectiveMagSize) return
    this.isReloading = true
    this.reloadTimer = this.def.reload_time * this.reloadSpeedMult
    this.onReloadStart()
  }

  // Override in subclasses to play per-weapon reload audio.
  protected onReloadStart(): void {}

  protected tickReload(dt: number): boolean {
    if (!this.isReloading) return false
    this.reloadTimer -= dt
    if (this.reloadTimer > 0) return false

    const needed   = this.effectiveMagSize - this.currentAmmo
    const transfer = Math.min(needed, this.reserveAmmo)
    this.currentAmmo += transfer
    this.reserveAmmo -= transfer
    this.isReloading  = false
    return true
  }

  protected castRay(): THREE.Intersection | null {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera)
    const hits = this.raycaster.intersectObjects(this.scene.children, true)
    return hits.length > 0 ? hits[0] : null
  }

  protected isHeadshot(hit: THREE.Intersection): boolean {
    return hit.object.userData['isHead'] === true
  }
}
