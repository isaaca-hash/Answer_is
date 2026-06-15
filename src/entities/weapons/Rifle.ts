import * as THREE from 'three'
import { Weapon } from './Weapon'
import type { HitResult } from './Weapon'
import type { WeaponDef } from '../../types/weapon.types'
import type { InputManager } from '../../core/InputManager'
import { useGameStore } from '../../ui/store'
import { AudioManager } from '../../core/AudioManager'

export class Rifle extends Weapon {
  constructor(def: WeaponDef, camera: THREE.PerspectiveCamera, scene: THREE.Scene, input: InputManager) {
    super(def, camera, scene, input)
  }

  update(dt: number): HitResult[] {
    const reloaded = this.tickReload(dt)
    if (reloaded) useGameStore.getState().updateAmmo(this.currentAmmo, this.reserveAmmo)

    if (this.fireTimer > 0) this.fireTimer -= dt
    if (this.input.justPressed('KeyR') && !this.isReloading) this.startReload()
    if (this.currentAmmo === 0 && !this.isReloading) this.startReload()

    useGameStore.getState().updateAmmo(this.currentAmmo, this.reserveAmmo)
    useGameStore.getState().setReloading(this.isReloading)

    // Auto: fires every frame LMB is held, throttled by RPM timer
    if (this.input.mouseDown(0) && !this.isReloading && this.currentAmmo > 0 && this.fireTimer <= 0) {
      const hit = this.fire()
      return hit ? [hit] : []
    }
    return []
  }

  protected onReloadStart(): void { AudioManager.getInstance().play('rifle_reload') }

  private fire(): HitResult | null {
    this.currentAmmo--
    this.fireTimer = 60 / this.def.rpm
    AudioManager.getInstance().play('rifle_fire', 0.8)
    useGameStore.getState().addRecoil(this.def.recoil_value * 0.012 * this.recoilMult)

    const hit = this.castRay()
    if (!hit?.point) return null

    const headshot = this.isHeadshot(hit)
    this.spawnImpactFlash(hit.point)

    return {
      point: hit.point.clone(),
      normal: hit.normal ?? new THREE.Vector3(0, 1, 0),
      damage: this.def.damage * this.upgradeMultiplier,
      headshotMultiplier: this.def.headshot_multiplier,
      isHeadshot: headshot,
      distance: hit.distance,
    }
  }

  private spawnImpactFlash(point: THREE.Vector3): void {
    const geo  = new THREE.SphereGeometry(0.04, 4, 4)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(point)
    this.scene.add(mesh)
    setTimeout(() => this.scene.remove(mesh), 60)
  }
}
