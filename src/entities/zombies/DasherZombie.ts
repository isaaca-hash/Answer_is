import * as THREE from 'three'
import { Zombie } from './Zombie'
import type { ZombieDef } from '../../types/zombie.types'
import { useGameStore } from '../../ui/store'

type DasherState = 'chase' | 'telegraph' | 'charging' | 'cooldown'

const CHARGE_TRIGGER_DIST = 10  // start charging when within this distance

export class DasherZombie extends Zombie {
  private state:        DasherState = 'chase'
  private telegraphTimer = 0
  private chargeTimer    = 0   // max charge duration before giving up
  private cooldownTimer  = 0
  private chargeTarget   = new THREE.Vector3()  // locked player position at charge start
  private flashTimer     = 0
  private flashOn        = false

  constructor(def: ZombieDef, scene: THREE.Scene) {
    super(def, scene)
  }

  protected buildMesh(): THREE.Group {
    const group = new THREE.Group()

    // Thin, tall body — purple to distinguish from normal
    const bodyGeo = new THREE.BoxGeometry(0.4, 1.4, 0.25)
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b008b })
    const body    = new THREE.Mesh(bodyGeo, this.bodyMat)
    body.position.y = 0.7
    body.castShadow = true
    body.userData['zombieRef'] = this
    group.add(body)

    const headGeo = new THREE.SphereGeometry(0.22, 8, 8)
    const headMat = new THREE.MeshStandardMaterial({ color: 0x6a0dad })
    const head    = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.65
    head.castShadow = true
    head.userData['isHead']     = true
    head.userData['zombieRef']  = this
    group.add(head)

    // HP bar
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x444444, depthTest: false }))
    barBg.position.y = 2.1
    barBg.renderOrder = 1
    group.add(barBg)

    this.hpBarFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xcc00cc, depthTest: false }))
    this.hpBarFill.position.set(0, 2.1, 0.01)
    this.hpBarFill.renderOrder = 2
    group.add(this.hpBarFill)

    return group
  }

  // Overridden activate to reset state machine
  activate(position: THREE.Vector3, scaledHp: number, scaledDamage: number): void {
    super.activate(position, scaledHp, scaledDamage)
    this.state          = 'chase'
    this.cooldownTimer  = 0
    this.telegraphTimer = 0
  }

  update(dt: number, playerPos: THREE.Vector3): number {
    if (!this.active) return 0

    this.flashTimer -= dt
    if (this.flashTimer <= 0) {
      this.flashTimer = 0.12
      this.flashOn = !this.flashOn
    }

    switch (this.state) {
      case 'chase':     return this.updateChase(dt, playerPos)
      case 'telegraph': return this.updateTelegraph(dt, playerPos)
      case 'charging':  return this.updateCharging(dt, playerPos)
      case 'cooldown':  return this.updateCooldown(dt, playerPos)
    }
  }

  private updateChase(dt: number, playerPos: THREE.Vector3): number {
    this.chasePlayer(dt, playerPos)
    const dist = this.distanceTo(playerPos)

    if (dist <= CHARGE_TRIGGER_DIST && this.cooldownTimer <= 0) {
      // Enter telegraph phase
      this.state          = 'telegraph'
      this.telegraphTimer = this.def.charge!.telegraph_time
      this.chargeTarget.copy(playerPos)
    }

    // Normal melee if very close
    if (dist <= this.def.attack_range && this.attackCooldown <= 0) {
      this.attackCooldown = this.def.attack_cooldown
      return this.damage
    }
    if (this.attackCooldown > 0) this.attackCooldown -= dt
    return 0
  }

  private updateTelegraph(dt: number, playerPos: THREE.Vector3): number {
    // Stop moving, flash body to telegraph
    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z)
    this.telegraphTimer -= dt

    // Flash the body material
    const mat = this.bodyMat
    if (mat) mat.color.set(this.flashOn ? 0xffffff : 0x8b008b)

    if (this.telegraphTimer <= 0) {
      if (mat) mat.color.set(0x8b008b)
      this.chargeTarget.copy(playerPos)  // lock target at moment of charge
      this.state      = 'charging'
      this.chargeTimer = 1.5  // give up charge after 1.5s if we miss
    }
    return 0
  }

  private updateCharging(dt: number, playerPos: THREE.Vector3): number {
    this.chargeTimer -= dt

    // Move toward locked target at charge speed
    const dir = new THREE.Vector3(
      this.chargeTarget.x - this.mesh.position.x,
      0,
      this.chargeTarget.z - this.mesh.position.z,
    )
    const dist = dir.length()

    if (dist < 0.5 || this.chargeTimer <= 0) {
      // Reached target or timed out
      this.state         = 'cooldown'
      this.cooldownTimer = this.def.charge!.charge_cooldown
      return 0
    }

    dir.divideScalar(dist)
    this.mesh.position.addScaledVector(dir, this.def.charge!.charge_speed * dt)
    this.mesh.lookAt(this.chargeTarget.x, this.mesh.position.y, this.chargeTarget.z)

    // Hit player check
    const playerDist = this.distanceTo(playerPos)
    if (playerDist <= 1.2) {
      // Charge hit — stun player and deal charge damage
      useGameStore.getState().setStunTimer(this.def.charge!.stun_duration)
      this.state         = 'cooldown'
      this.cooldownTimer = this.def.charge!.charge_cooldown
      return this.def.charge!.damage
    }
    return 0
  }

  private updateCooldown(dt: number, playerPos: THREE.Vector3): number {
    this.cooldownTimer -= dt
    this.chasePlayer(dt, playerPos)
    if (this.cooldownTimer <= 0) this.state = 'chase'
    return 0
  }

  // Assigned in buildMesh() which is called from super()
  private bodyMat!: THREE.MeshStandardMaterial
}
