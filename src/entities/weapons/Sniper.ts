import * as THREE from 'three'
import { Weapon } from './Weapon'
import type { HitResult } from './Weapon'
import type { WeaponDef } from '../../types/weapon.types'
import type { InputManager } from '../../core/InputManager'
import { useGameStore } from '../../ui/store'
import { AudioManager } from '../../core/AudioManager'

const BASE_FOV  = 90
const SCOPE_FOV = BASE_FOV / 3.5  // ≈25.7° for 3.5×

export class Sniper extends Weapon {
  private prevFiring = false
  private prevAiming = false
  private isScoped   = false
  private setFOV: (fov: number) => void

  constructor(
    def: WeaponDef,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    input: InputManager,
    setFOV: (fov: number) => void,
  ) {
    super(def, camera, scene, input)
    this.setFOV = setFOV
  }

  update(dt: number): HitResult[] {
    const reloaded = this.tickReload(dt)
    if (reloaded) useGameStore.getState().updateAmmo(this.currentAmmo, this.reserveAmmo)

    if (this.fireTimer > 0) this.fireTimer -= dt
    if (this.input.justPressed('KeyR') && !this.isReloading) this.startReload()
    if (this.currentAmmo === 0 && !this.isReloading) this.startReload()

    const aiming = this.input.mouseDown(2)
    if (aiming && !this.prevAiming) this.enterScope()
    if (!aiming && this.prevAiming) this.exitScope()
    this.prevAiming = aiming

    const firing    = this.input.mouseDown(0)
    const justFired = firing && !this.prevFiring
    this.prevFiring = firing

    useGameStore.getState().updateAmmo(this.currentAmmo, this.reserveAmmo)
    useGameStore.getState().setReloading(this.isReloading)

    if (justFired && !this.isReloading && this.currentAmmo > 0 && this.fireTimer <= 0) {
      const results = this.fire()
      this.exitScope()  // bolt cycle ejects you from scope
      return results
    }
    return []
  }

  // Fires through up to `penetration` zombies along the ray
  private fire(): HitResult[] {
    this.currentAmmo--
    this.fireTimer = 60 / this.def.rpm
    AudioManager.getInstance().play('sniper_fire', 1.0)
    useGameStore.getState().addRecoil(this.def.recoil_value * 0.03 * this.recoilMult)

    const maxPen = this.def.penetration ?? 1
    const origin    = new THREE.Vector3()
    const direction = new THREE.Vector3()
    this.camera.getWorldPosition(origin)
    this.camera.getWorldDirection(direction)

    const rc = new THREE.Raycaster()
    rc.set(origin, direction)
    const allHits = rc.intersectObjects(this.scene.children, true)

    this.spawnMuzzleFlash(origin, direction)

    const results: HitResult[] = []
    let penetrationsLeft = maxPen

    for (const h of allHits) {
      if (penetrationsLeft <= 0) break
      if (!h.object.userData['zombieRef']) continue  // skip non-zombie hits

      const headshot = h.object.userData['isHead'] === true
      results.push({
        point: h.point.clone(),
        normal: h.normal ?? new THREE.Vector3(0, 1, 0),
        damage: this.def.damage * this.upgradeMultiplier,
        headshotMultiplier: this.def.headshot_multiplier,
        isHeadshot: headshot,
        distance: h.distance,
      })
      penetrationsLeft--
    }

    return results
  }

  private enterScope(): void {
    this.isScoped = true
    this.setFOV(SCOPE_FOV)
    useGameStore.getState().setScoped(true)
  }

  protected onReloadStart(): void { AudioManager.getInstance().play('sniper_reload') }

  exitScope(): void {
    if (!this.isScoped) return
    this.isScoped = false
    this.setFOV(BASE_FOV)
    useGameStore.getState().setScoped(false)
  }

  private spawnMuzzleFlash(origin: THREE.Vector3, direction: THREE.Vector3): void {
    const geo  = new THREE.SphereGeometry(0.06, 4, 4)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(origin).addScaledVector(direction, 0.5)
    this.scene.add(mesh)
    setTimeout(() => this.scene.remove(mesh), 100)
  }
}
