import * as THREE from 'three'
import { Zombie } from './Zombie'
import type { ZombieDef } from '../../types/zombie.types'

// Boomer explodes when it gets close to the player.
// Explosion is signaled by returning a large damage value — Game.ts / SpawnManager
// treats any damage >= EXPLOSION_SIGNAL as a Boomer detonation and calls releaseZombie.
export const BOOMER_EXPLODE_SIGNAL = 9999

export class BoomerZombie extends Zombie {
  private exploded = false

  constructor(def: ZombieDef, scene: THREE.Scene) {
    super(def, scene)
  }

  activate(position: THREE.Vector3, scaledHp: number, scaledDamage: number): void {
    super.activate(position, scaledHp, scaledDamage)
    this.exploded = false
  }

  protected buildMesh(): THREE.Group {
    const group = new THREE.Group()

    // Fat round body — orange
    const bodyGeo = new THREE.SphereGeometry(0.45, 8, 8)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x331100 })
    const body    = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.55
    body.castShadow = true
    body.userData['zombieRef'] = this
    group.add(body)

    const headGeo = new THREE.SphereGeometry(0.28, 8, 8)
    const headMat = new THREE.MeshStandardMaterial({ color: 0xcc4400 })
    const head    = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.25
    head.userData['isHead']    = true
    head.userData['zombieRef'] = this
    group.add(head)

    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x444444, depthTest: false }))
    barBg.position.y = 1.8
    barBg.renderOrder = 1
    group.add(barBg)

    this.hpBarFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff6600, depthTest: false }))
    this.hpBarFill.position.set(0, 1.8, 0.01)
    this.hpBarFill.renderOrder = 2
    group.add(this.hpBarFill)

    return group
  }

  update(dt: number, playerPos: THREE.Vector3): number {
    if (!this.active || this.exploded) return 0

    this.chasePlayer(dt, playerPos)
    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z)

    const dist = this.distanceTo(playerPos)
    if (dist <= this.def.explosion!.trigger_range) {
      this.exploded = true
      // Explosion damage + AoE radius are stored in def; signal via large damage value
      // SpawnManager reads this and calls releaseZombie + AoE in Game.ts
      return BOOMER_EXPLODE_SIGNAL
    }
    return 0
  }

  // Returns explosion data for Game.ts to use in AoE calculation
  getExplosionData(): { damage: number; radius: number } {
    return {
      damage: this.def.explosion!.damage,
      radius: this.def.explosion!.radius,
    }
  }
}
