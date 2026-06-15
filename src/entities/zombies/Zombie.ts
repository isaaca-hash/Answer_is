import * as THREE from 'three'
import type { ZombieDef } from '../../types/zombie.types'

// Base class for all zombie types. Implements the object-pool interface:
// activate() restores state; deactivate() hides the mesh but keeps it in the scene.
export abstract class Zombie {
  readonly def: ZombieDef

  protected mesh: THREE.Group
  protected hpBarFill!: THREE.Mesh  // assigned by buildMesh() before use
  protected scene: THREE.Scene

  hp = 0
  maxHp = 0
  speed = 0
  damage = 0
  active = false

  protected attackCooldown = 0

  constructor(def: ZombieDef, scene: THREE.Scene) {
    this.def = def
    this.scene = scene
    this.mesh = this.buildMesh()
    scene.add(this.mesh)
    this.deactivate()
  }

  // Subclasses override to provide their specific mesh
  protected abstract buildMesh(): THREE.Group

  // --- Object Pool interface ---

  activate(position: THREE.Vector3, scaledHp: number, scaledDamage: number): void {
    this.hp = scaledHp
    this.maxHp = scaledHp
    this.speed = this.def.speed
    this.damage = scaledDamage
    this.active = true
    this.attackCooldown = 0
    this.mesh.position.copy(position)
    this.mesh.visible = true
    this.mesh.traverse(o => { o.visible = true })
  }

  deactivate(): void {
    this.active = false
    this.mesh.visible = false
    this.mesh.traverse(o => { o.visible = false })
  }

  // Returns damage dealt to player this frame (0 if not attacking)
  abstract update(dt: number, playerPos: THREE.Vector3): number

  // Returns true when the zombie is dead (caller should release to pool)
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount)
    this.updateHpBar()
    return this.hp <= 0
  }

  getPosition(): THREE.Vector3 { return this.mesh.position.clone() }

  // Bounding sphere for hit detection — centered at body mid-point, covers head too
  getBoundingSphere(): THREE.Sphere {
    const center = this.mesh.position.clone()
    center.y += 0.9  // lift to body center (head is at 1.5, body spans 0–1.2)
    return new THREE.Sphere(center, 1.0)
  }

  protected updateHpBar(): void {
    const pct = this.hp / this.maxHp
    this.hpBarFill.scale.x = Math.max(0, pct)
    this.hpBarFill.position.x = (pct - 1) * 0.5  // keep bar left-anchored
  }

  // Shared chase logic: move toward player on XZ plane
  protected chasePlayer(dt: number, playerPos: THREE.Vector3): void {
    const dir = new THREE.Vector3(
      playerPos.x - this.mesh.position.x,
      0,
      playerPos.z - this.mesh.position.z,
    )
    const dist = dir.length()
    if (dist < 0.1) return
    dir.divideScalar(dist)
    this.mesh.position.addScaledVector(dir, this.speed * dt)
    // Face the player
    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z)
  }

  protected distanceTo(playerPos: THREE.Vector3): number {
    return this.mesh.position.distanceTo(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z))
  }

  dispose(): void {
    this.scene.remove(this.mesh)
  }
}
