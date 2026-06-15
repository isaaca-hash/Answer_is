import * as THREE from 'three'
import { Zombie } from './Zombie'
import type { ZombieDef } from '../../types/zombie.types'

const PREFERRED_DIST = 12    // gunner tries to stay this far from player
const PROJECTILE_RADIUS = 0.12

interface Projectile {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  lifetime: number
}

// Signal value returned from update() when the summon ability triggers
export const GUNNER_SUMMON_SIGNAL = 8888

export class GunnerZombie extends Zombie {
  private burstTimer      = 0
  private shotsInBurst    = 0
  private burstCooldown   = 0
  private projectiles:    Projectile[] = []
  private hasSummoned     = false
  // Injected by SpawnManager so Gunner can request extra spawns
  onSummonRequest: ((count: number) => void) | null = null

  constructor(def: ZombieDef, scene: THREE.Scene) {
    super(def, scene)
  }

  protected buildMesh(): THREE.Group {
    const group = new THREE.Group()

    // Stocky body — dark blue
    const bodyGeo = new THREE.BoxGeometry(0.65, 1.1, 0.35)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a237e })
    const body    = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.55
    body.castShadow = true
    body.userData['zombieRef'] = this
    group.add(body)

    // "Gun" barrel sticking out front
    const barrelGeo = new THREE.BoxGeometry(0.08, 0.08, 0.5)
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x333333 })
    const barrel    = new THREE.Mesh(barrelGeo, barrelMat)
    barrel.position.set(0.25, 0.6, -0.45)
    group.add(barrel)

    const headGeo = new THREE.SphereGeometry(0.24, 8, 8)
    const headMat = new THREE.MeshStandardMaterial({ color: 0x283593 })
    const head    = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.42
    head.userData['isHead']    = true
    head.userData['zombieRef'] = this
    group.add(head)

    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x444444, depthTest: false }))
    barBg.position.y = 2.0
    barBg.renderOrder = 1
    group.add(barBg)

    this.hpBarFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.08),
      new THREE.MeshBasicMaterial({ color: 0x3f51b5, depthTest: false }))
    this.hpBarFill.position.set(0, 2.0, 0.01)
    this.hpBarFill.renderOrder = 2
    group.add(this.hpBarFill)

    return group
  }

  activate(pos: THREE.Vector3, hp: number, dmg: number): void {
    super.activate(pos, hp, dmg)
    this.burstTimer   = 1.5   // short delay before first shot
    this.shotsInBurst = 0
    this.burstCooldown = 0
    this.hasSummoned  = false
    this.clearProjectiles()
  }

  deactivate(): void {
    this.clearProjectiles()
    super.deactivate()
  }

  update(dt: number, playerPos: THREE.Vector3): number {
    if (!this.active) return 0

    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z)

    // Kite: move away if too close, forward if too far
    const dist = this.distanceTo(playerPos)
    if (dist < PREFERRED_DIST - 2) {
      // Back away slowly
      const awayDir = new THREE.Vector3(
        this.mesh.position.x - playerPos.x, 0,
        this.mesh.position.z - playerPos.z,
      ).normalize()
      this.mesh.position.addScaledVector(awayDir, this.speed * 0.5 * dt)
    } else if (dist > PREFERRED_DIST + 4) {
      this.chasePlayer(dt, playerPos)
    }

    // Check low-HP summon trigger (10%)
    if (!this.hasSummoned && this.hp / this.maxHp <= this.def.summon_ability!.trigger_hp_threshold) {
      this.hasSummoned = true
      this.onSummonRequest?.(this.def.summon_ability!.summon_count)
    }

    // Burst fire
    let dmgDealt = 0
    dmgDealt += this.updateFiring(dt, playerPos)
    dmgDealt += this.updateProjectiles(dt, playerPos)

    return dmgDealt
  }

  private updateFiring(dt: number, playerPos: THREE.Vector3): number {
    const ranged = this.def.ranged!

    if (this.burstCooldown > 0) {
      this.burstCooldown -= dt
      return 0
    }

    this.burstTimer -= dt
    if (this.burstTimer > 0) return 0

    // Fire one shot in the burst
    const fireInterval = 1 / ranged.fire_rate
    this.burstTimer    = fireInterval
    this.shotsInBurst++

    this.spawnProjectile(playerPos, ranged.projectile_speed, ranged.accuracy)

    if (this.shotsInBurst >= ranged.burst_count) {
      this.shotsInBurst  = 0
      this.burstCooldown = ranged.burst_cooldown
    }
    return 0
  }

  private spawnProjectile(playerPos: THREE.Vector3, speed: number, accuracy: number): void {
    const origin = new THREE.Vector3()
    this.mesh.getWorldPosition(origin)
    origin.y += 0.6  // barrel height

    const dir = new THREE.Vector3(
      playerPos.x - origin.x,
      (playerPos.y + 1.0) - origin.y,  // aim at player chest
      playerPos.z - origin.z,
    ).normalize()

    // Apply inaccuracy
    const inaccuracy = (1 - accuracy) * 0.3
    dir.x += (Math.random() - 0.5) * inaccuracy
    dir.y += (Math.random() - 0.5) * inaccuracy
    dir.z += (Math.random() - 0.5) * inaccuracy
    dir.normalize()

    const geo  = new THREE.SphereGeometry(PROJECTILE_RADIUS, 4, 4)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff4400 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(origin)
    this.scene.add(mesh)

    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(speed),
      lifetime: 2.5,
    })
  }

  private updateProjectiles(dt: number, playerPos: THREE.Vector3): number {
    let dmg = 0
    const toRemove: Projectile[] = []

    for (const p of this.projectiles) {
      p.mesh.position.addScaledVector(p.velocity, dt)
      p.lifetime -= dt

      // Hit check: sphere vs player capsule center
      const playerCenter = new THREE.Vector3(playerPos.x, playerPos.y + 1.0, playerPos.z)
      if (p.mesh.position.distanceTo(playerCenter) < 0.45) {
        dmg += this.damage
        toRemove.push(p)
      } else if (p.lifetime <= 0 || p.mesh.position.y < -1) {
        toRemove.push(p)
      }
    }

    for (const p of toRemove) {
      this.scene.remove(p.mesh)
      this.projectiles = this.projectiles.filter(x => x !== p)
    }

    return dmg
  }

  private clearProjectiles(): void {
    for (const p of this.projectiles) this.scene.remove(p.mesh)
    this.projectiles = []
  }
}
