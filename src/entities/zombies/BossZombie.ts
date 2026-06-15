import * as THREE from 'three'
import { Zombie } from './Zombie'
import type { ZombieDef } from '../../types/zombie.types'

// Signal returned when boss enters Phase 2 summon tick
export const BOSS_SUMMON_SIGNAL = 7777

type BossPhase = 'phase1' | 'phase2'

export class BossZombie extends Zombie {
  private phase:        BossPhase = 'phase1'
  private summonTimer:  number = 0
  private hasEnteredP2: boolean = false

  // Injected by SpawnManager so boss can summon minions
  onSummonRequest: ((types: string[]) => void) | null = null

  constructor(def: ZombieDef, scene: THREE.Scene) {
    super(def, scene)
  }

  activate(pos: THREE.Vector3, hp: number, dmg: number): void {
    super.activate(pos, hp, dmg)
    this.phase        = 'phase1'
    this.hasEnteredP2 = false
    this.summonTimer  = 0
  }

  protected buildMesh(): THREE.Group {
    const group = new THREE.Group()

    // Large imposing body — dark red
    const bodyGeo = new THREE.BoxGeometry(1.1, 1.8, 0.6)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.6 })
    const body    = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.9
    body.castShadow = true
    body.userData['zombieRef'] = this
    group.add(body)

    // Crown / spikes — tall head marker
    const headGeo = new THREE.ConeGeometry(0.35, 0.6, 6)
    const headMat = new THREE.MeshStandardMaterial({ color: 0xcc0000 })
    const head    = new THREE.Mesh(headGeo, headMat)
    head.position.y = 2.2
    head.userData['isHead']          = true
    head.userData['zombieRef']        = this
    head.userData['weakPointMult']    = 2.0  // boss head = 2× damage
    group.add(head)

    // "4-Star" shoulder markers (4 small gold spheres)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      const star  = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.3 }),
      )
      star.position.set(Math.cos(angle) * 0.7, 1.8, Math.sin(angle) * 0.7)
      group.add(star)
    }

    // HP bar — extra wide for boss
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.15),
      new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false }))
    barBg.position.y = 2.8
    barBg.renderOrder = 1
    group.add(barBg)

    this.hpBarFill = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: false }))
    this.hpBarFill.position.set(0, 2.8, 0.01)
    this.hpBarFill.renderOrder = 2
    group.add(this.hpBarFill)

    return group
  }

  private hpBarWidth = 2  // boss HP bar is 2 units wide

  protected updateHpBar(): void {
    const pct = this.hp / this.maxHp
    this.hpBarFill.scale.x = Math.max(0, pct)
    this.hpBarFill.position.x = (pct - 1) * this.hpBarWidth * 0.5
  }

  update(dt: number, playerPos: THREE.Vector3): number {
    if (!this.active) return 0

    // Phase 2 transition
    const p2Threshold = this.def.phase_2!.trigger_hp
    if (!this.hasEnteredP2 && this.hp <= p2Threshold) {
      this.hasEnteredP2 = true
      this.phase        = 'phase2'
      this.summonTimer  = 0  // summon immediately on entering phase 2
      this.flashPhaseChange()
    }

    // Phase 2: periodic summons
    if (this.phase === 'phase2') {
      this.summonTimer -= dt
      if (this.summonTimer <= 0) {
        this.summonTimer = this.def.phase_2!.summon_interval
        const types = this.def.phase_2!.summon_pool
        this.onSummonRequest?.(types)
      }
    }

    // Chase + heavy melee
    this.chasePlayer(dt, playerPos)
    this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z)

    const dist = this.distanceTo(playerPos)
    if (dist <= this.def.attack_range && this.attackCooldown <= 0) {
      this.attackCooldown = this.def.attack_cooldown
      return this.damage
    }
    if (this.attackCooldown > 0) this.attackCooldown -= dt
    return 0
  }

  private flashPhaseChange(): void {
    // Brief red flash to signal phase 2 start
    const geo  = new THREE.SphereGeometry(2, 8, 8)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.6 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(this.mesh.position)
    this.scene.add(mesh)
    let life = 0.5
    const tick = () => {
      life -= 0.016
      mat.opacity = Math.max(0, life / 0.5) * 0.6
      if (life > 0) requestAnimationFrame(tick)
      else this.scene.remove(mesh)
    }
    tick()
  }
}
