import * as THREE from 'three'
import { Weapon } from './Weapon'
import type { HitResult } from './Weapon'
import type { WeaponDef } from '../../types/weapon.types'
import type { InputManager } from '../../core/InputManager'
import { useGameStore } from '../../ui/store'
import { AudioManager } from '../../core/AudioManager'

const SPREAD_HALF_ANGLE = 0.14  // ~8° half-angle cone

export class Shotgun extends Weapon {
  private shellLoadTimer = 0
  private loadingShells  = false
  private prevFiring     = false

  constructor(def: WeaponDef, camera: THREE.PerspectiveCamera, scene: THREE.Scene, input: InputManager) {
    super(def, camera, scene, input)
  }

  update(dt: number): HitResult[] {
    if (this.fireTimer > 0) this.fireTimer -= dt

    // Per-shell reload tick
    if (this.loadingShells) {
      this.shellLoadTimer -= dt
      if (this.shellLoadTimer <= 0) {
        if (this.reserveAmmo > 0 && this.currentAmmo < this.def.mag_size) {
          this.currentAmmo++
          this.reserveAmmo--
        }
        if (this.currentAmmo < this.def.mag_size && this.reserveAmmo > 0) {
          this.shellLoadTimer = this.def.reload_time * this.reloadSpeedMult
        } else {
          this.loadingShells = false
          this.isReloading   = false
        }
      }
    }

    if (!this.loadingShells) {
      if (this.input.justPressed('KeyR') && this.currentAmmo < this.def.mag_size && this.reserveAmmo > 0) {
        this.beginShellReload()
      }
      if (this.currentAmmo === 0 && this.reserveAmmo > 0) this.beginShellReload()
    }

    const firing    = this.input.mouseDown(0)
    const justFired = firing && !this.prevFiring
    this.prevFiring = firing

    useGameStore.getState().updateAmmo(this.currentAmmo, this.reserveAmmo)
    useGameStore.getState().setReloading(this.isReloading)

    if (justFired && this.currentAmmo > 0 && this.fireTimer <= 0) {
      if (this.loadingShells) {
        // LMB during reload cancels it so player fires what's loaded
        this.loadingShells = false
        this.isReloading   = false
      }
      return this.fire()
    }
    return []
  }

  private beginShellReload(): void {
    this.isReloading    = true
    this.loadingShells  = true
    this.shellLoadTimer = this.def.reload_time * this.reloadSpeedMult
    AudioManager.getInstance().play('shotgun_reload', 0.8)
  }

  // Returns one HitResult per distinct zombie hit, with aggregated pellet damage
  private fire(): HitResult[] {
    this.currentAmmo--
    this.fireTimer = 60 / this.def.rpm
    AudioManager.getInstance().play('shotgun_fire', 0.9)
    useGameStore.getState().addRecoil(this.def.recoil_value * 0.02 * this.recoilMult)

    const pelletCount = this.def.pellets ?? 26
    const dmgPerPellet = this.def.damage * this.upgradeMultiplier

    const origin    = new THREE.Vector3()
    const direction = new THREE.Vector3()
    this.camera.getWorldPosition(origin)
    this.camera.getWorldDirection(direction)

    // Accumulate damage per zombie instance — Map supports object keys natively
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zombieHits = new Map<object, { result: HitResult; totalDmg: number }>()
    let anyHit = false

    for (let i = 0; i < pelletCount; i++) {
      const spreadDir = direction.clone()
      spreadDir.x += (Math.random() - 0.5) * 2 * SPREAD_HALF_ANGLE
      spreadDir.y += (Math.random() - 0.5) * 2 * SPREAD_HALF_ANGLE
      spreadDir.normalize()

      const rc = new THREE.Raycaster()
      rc.set(origin, spreadDir)
      const hits = rc.intersectObjects(this.scene.children, true)
      if (!hits.length) continue

      const h    = hits[0]
      const dist = h.distance
      const falloffStart = this.def.damage_falloff_start ?? 8
      const falloffEnd   = this.def.damage_falloff_end   ?? 15
      const falloff = dist <= falloffStart ? 1
        : dist >= falloffEnd ? 0
        : 1 - (dist - falloffStart) / (falloffEnd - falloffStart)

      const pelletDmg = dmgPerPellet * falloff
      if (pelletDmg <= 0) continue

      anyHit = true
      this.spawnImpactFlash(h.point)

      // Group by zombie instance so pellets on body + head of the same zombie aggregate
      const zombieRef = h.object.userData['zombieRef'] as object | undefined
      if (zombieRef) {
        const existing = zombieHits.get(zombieRef)
        if (existing) {
          existing.totalDmg += pelletDmg
        } else {
          zombieHits.set(zombieRef, {
            result: {
              point: h.point.clone(),
              normal: h.normal ?? new THREE.Vector3(0, 1, 0),
              damage: pelletDmg,
              headshotMultiplier: this.def.headshot_multiplier,
              isHeadshot: h.object.userData['isHead'] === true,
              distance: dist,
            },
            totalDmg: pelletDmg,
          })
        }
      }
    }

    if (!anyHit) return []

    // Build final results with aggregated damage
    return Array.from(zombieHits.values()).map(({ result, totalDmg }) => ({
      ...result,
      damage: totalDmg,
    }))
  }

  private spawnImpactFlash(point: THREE.Vector3): void {
    const geo  = new THREE.SphereGeometry(0.03, 4, 4)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff6600 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(point)
    this.scene.add(mesh)
    setTimeout(() => this.scene.remove(mesh), 50)
  }
}
