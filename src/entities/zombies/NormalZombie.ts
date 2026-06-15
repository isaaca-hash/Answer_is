import * as THREE from 'three'
import { Zombie } from './Zombie'
import type { ZombieDef } from '../../types/zombie.types'

// Placeholder visuals: green box body + red head sphere.
// Replace buildMesh() with a GLB loader call once real assets are available.
export class NormalZombie extends Zombie {
  constructor(def: ZombieDef, scene: THREE.Scene) {
    super(def, scene)
  }

  protected buildMesh(): THREE.Group {
    const group = new THREE.Group()

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.6, 1.2, 0.3)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2d6e2d })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.6
    body.castShadow = true
    group.add(body)

    // Head — tagged isHead=true for headshot detection
    const headGeo = new THREE.SphereGeometry(0.25, 8, 8)
    const headMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 1.5
    head.castShadow = true
    head.userData['isHead'] = true   // headshot tag
    head.userData['zombieRef'] = this
    body.userData['zombieRef'] = this
    group.add(head)

    // HP bar background (grey)
    const barBgGeo = new THREE.PlaneGeometry(1, 0.1)
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x444444, depthTest: false })
    const barBg = new THREE.Mesh(barBgGeo, barBgMat)
    barBg.position.y = 2.0
    barBg.renderOrder = 1
    group.add(barBg)

    // HP bar fill (red)
    const barFillGeo = new THREE.PlaneGeometry(1, 0.08)
    const barFillMat = new THREE.MeshBasicMaterial({ color: 0xff2222, depthTest: false })
    this.hpBarFill = new THREE.Mesh(barFillGeo, barFillMat)
    this.hpBarFill.position.y = 2.0
    this.hpBarFill.position.z = 0.01
    this.hpBarFill.renderOrder = 2
    group.add(this.hpBarFill)

    return group
  }

  update(dt: number, playerPos: THREE.Vector3): number {
    if (!this.active) return 0

    const dist = this.distanceTo(playerPos)

    if (dist > this.def.attack_range) {
      this.chasePlayer(dt, playerPos)
    }

    // Always face player
    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z)

    // Melee attack
    if (dist <= this.def.attack_range && this.attackCooldown <= 0) {
      this.attackCooldown = this.def.attack_cooldown
      return this.damage
    }

    if (this.attackCooldown > 0) this.attackCooldown -= dt

    return 0
  }
}
