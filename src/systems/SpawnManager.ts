import * as THREE from 'three'
import { NormalZombie }              from '../entities/zombies/NormalZombie'
import { DasherZombie }              from '../entities/zombies/DasherZombie'
import { BoomerZombie, BOOMER_EXPLODE_SIGNAL } from '../entities/zombies/BoomerZombie'
import { GunnerZombie }              from '../entities/zombies/GunnerZombie'
import { BossZombie }                from '../entities/zombies/BossZombie'
import type { Zombie }               from '../entities/zombies/Zombie'
import type { ZombieDef }            from '../types/zombie.types'
import { zombieCountForWave }        from '../types/game.types'
import zombiesData                   from '../data/zombies.json'
import { useGameStore }              from '../ui/store'

const ARENA_SIZE  = 38
const POOL_SIZES  = { normal: 120, dasher: 20, boomer: 4, gunner: 10, boss: 3 }

// Pre-computes scaled HP/damage for a zombie def at a given wave
function scaleStats(def: ZombieDef, wave: number, scaling: { health_increase_per_wave: number; damage_increase_per_wave: number }) {
  const hpMult  = Math.pow(1 + scaling.health_increase_per_wave,  wave - 1)
  const dmgMult = Math.pow(1 + scaling.damage_increase_per_wave, wave - 1)
  return { hp: def.hp * hpMult, damage: def.damage * dmgMult }
}

// Manages all zombie pools: spawning, updating, releasing, and Boomer/Boss signals.
export class SpawnManager {
  private scene:   THREE.Scene
  private active:  Set<Zombie> = new Set()

  private pools = {
    normal: [] as NormalZombie[],
    dasher: [] as DasherZombie[],
    boomer: [] as BoomerZombie[],
    gunner: [] as GunnerZombie[],
    boss:   [] as BossZombie[],
  }

  private defs:    Map<string, ZombieDef>
  private scaling: { health_increase_per_wave: number; damage_increase_per_wave: number }

  // Injected by Game so SpawnManager can forward zombie-kill events
  onZombieKilled: (() => void) | null = null
  onPlayerDamage: ((dmg: number) => void) | null = null

  constructor(scene: THREE.Scene) {
    this.scene = scene
    const data = zombiesData as { zombies: ZombieDef[]; scaling: typeof zombiesData.scaling }
    this.defs    = new Map(data.zombies.map(z => [z.id, z]))
    this.scaling = data.scaling

    this.preallocatePools()
  }

  private preallocatePools(): void {
    const build = <T extends Zombie>(
      count: number, factory: () => T, pool: T[]
    ) => { for (let i = 0; i < count; i++) pool.push(factory()) }

    build(POOL_SIZES.normal, () => new NormalZombie(this.defs.get('normal')!, this.scene), this.pools.normal)
    build(POOL_SIZES.dasher, () => new DasherZombie(this.defs.get('dasher')!, this.scene), this.pools.dasher)
    build(POOL_SIZES.boomer, () => new BoomerZombie(this.defs.get('boomer')!, this.scene), this.pools.boomer)
    build(POOL_SIZES.gunner, () => new GunnerZombie(this.defs.get('gunner')!, this.scene), this.pools.gunner)
    build(POOL_SIZES.boss,   () => new BossZombie  (this.defs.get('boss_4star')!, this.scene), this.pools.boss)
  }

  // Called by WaveManager to start a normal (non-boss) wave
  spawnWave(count: number, wave: number): void {
    const eligible = this.eligibleNonBossTypes(wave)
    for (let i = 0; i < count; i++) {
      const def = this.weightedPick(eligible, wave)
      if (!def) continue
      this.spawnZombie(def, wave)
    }
  }

  // Called by WaveManager for every 10th wave: 1 boss + half normal count
  spawnBossWave(wave: number): void {
    const boss = this.pools.boss.pop()
    if (boss) {
      const { hp, damage } = scaleStats(this.defs.get('boss_4star')!, wave, this.scaling)
      const pos = this.randomEdgePosition()
      boss.activate(pos, hp, damage)
      boss.onSummonRequest = (types) => this.summonForBoss(types, wave)
      this.active.add(boss)
    }
    // Also spawn 50% of normal wave count simultaneously
    const normalCount = Math.floor(zombieCountForWave(wave) * 0.5)
    this.spawnWave(normalCount, wave)
  }

  // Update all active zombies, handle signals, return nothing (side-effects via callbacks)
  update(dt: number, playerPos: THREE.Vector3): number[] {
    const damages: number[] = []

    for (const z of [...this.active]) {
      const rawDmg = z.update(dt, playerPos)
      if (rawDmg <= 0) continue

      if (rawDmg === BOOMER_EXPLODE_SIGNAL) {
        this.handleBoomerExplosion(z as BoomerZombie, playerPos)
      } else {
        damages.push(rawDmg)
      }
    }
    return damages
  }

  private handleBoomerExplosion(boomer: BoomerZombie, playerPos: THREE.Vector3): void {
    const { damage, radius } = boomer.getExplosionData()
    this.releaseZombie(boomer)
    this.onZombieKilled?.()

    // AoE: check distance from boomer center to player
    const boomerPos = boomer.getPosition()
    const dist = boomerPos.distanceTo(new THREE.Vector3(playerPos.x, boomerPos.y, playerPos.z))
    if (dist <= radius) {
      // Linear falloff
      const falloff = 1 - dist / radius
      this.onPlayerDamage?.(damage * falloff)
    }

    // Also hurt other zombies in radius
    for (const z of [...this.active]) {
      if (z.getPosition().distanceTo(boomerPos) <= radius) {
        const died = z.takeDamage(damage * 0.5)
        if (died) {
          useGameStore.getState().addCurrency(z.def.drop_currency)
          useGameStore.getState().incrementKills()
          this.releaseZombie(z)
          this.onZombieKilled?.()
        }
      }
    }

    this.spawnExplosionVfx(boomerPos, radius)
  }

  private spawnZombie(def: ZombieDef, wave: number): void {
    const pos            = this.randomEdgePosition()
    const { hp, damage } = scaleStats(def, wave, this.scaling)
    const zombie         = this.getFromPool(def.id)
    if (!zombie) return

    zombie.activate(pos, hp, damage)

    // Wire up Gunner summon callback
    if (zombie instanceof GunnerZombie) {
      zombie.onSummonRequest = (count) => {
        const normalDef = this.defs.get('normal')!
        for (let i = 0; i < count; i++) this.spawnZombie(normalDef, wave)
      }
    }

    this.active.add(zombie)
  }

  private summonForBoss(types: string[], wave: number): void {
    for (const id of types) {
      const def = this.defs.get(id)
      if (def) this.spawnZombie(def, wave)
    }
  }

  // Hitscan: find first zombie whose bounding sphere contains the point
  getZombieAt(point: THREE.Vector3): Zombie | null {
    for (const z of this.active) {
      if (z.getBoundingSphere().containsPoint(point)) return z
    }
    return null
  }

  // AoE: all zombies within radius
  getZombiesInRadius(center: THREE.Vector3, radius: number): Zombie[] {
    const result: Zombie[] = []
    for (const z of this.active) {
      if (z.getPosition().distanceTo(center) <= radius) result.push(z)
    }
    return result
  }

  releaseZombie(zombie: Zombie): void {
    zombie.deactivate()
    this.active.delete(zombie)
    this.returnToPool(zombie)
  }

  get activeCount(): number { return this.active.size }
  get activeBoomers(): number {
    let n = 0
    for (const z of this.active) { if (z instanceof BoomerZombie) n++ }
    return n
  }

  // --- Helpers ---

  private eligibleNonBossTypes(wave: number): ZombieDef[] {
    return [...this.defs.values()].filter(d =>
      !d.is_boss && d.weight > 0 && d.spawn_wave <= wave
    )
  }

  private weightedPick(defs: ZombieDef[], _wave: number): ZombieDef | null {
    if (!defs.length) return this.defs.get('normal') ?? null

    // Filter Boomer if at max concurrent
    const eligible = defs.filter(d =>
      d.id !== 'boomer' || this.activeBoomers < (d.max_concurrent ?? 2)
    )
    if (!eligible.length) return this.defs.get('normal') ?? null

    const totalWeight = eligible.reduce((s, d) => s + d.weight, 0)
    let roll = Math.random() * totalWeight
    for (const d of eligible) {
      roll -= d.weight
      if (roll <= 0) return d
    }
    return eligible[eligible.length - 1]
  }

  private getFromPool(id: string): Zombie | null {
    switch (id) {
      case 'normal':    return this.pools.normal.pop()  ?? null
      case 'dasher':    return this.pools.dasher.pop()  ?? null
      case 'boomer':    return this.pools.boomer.pop()  ?? null
      case 'gunner':    return this.pools.gunner.pop()  ?? null
      case 'boss_4star':return this.pools.boss.pop()    ?? null
      default:          return this.pools.normal.pop()  ?? null
    }
  }

  private returnToPool(zombie: Zombie): void {
    if (zombie instanceof NormalZombie) this.pools.normal.push(zombie)
    else if (zombie instanceof DasherZombie) this.pools.dasher.push(zombie)
    else if (zombie instanceof BoomerZombie) this.pools.boomer.push(zombie)
    else if (zombie instanceof GunnerZombie) this.pools.gunner.push(zombie)
    else if (zombie instanceof BossZombie)   this.pools.boss.push(zombie)
  }

  private randomEdgePosition(): THREE.Vector3 {
    const side = Math.floor(Math.random() * 4)
    const t    = (Math.random() * 2 - 1) * ARENA_SIZE
    switch (side) {
      case 0: return new THREE.Vector3( ARENA_SIZE, 0,  t)
      case 1: return new THREE.Vector3(-ARENA_SIZE, 0,  t)
      case 2: return new THREE.Vector3( t, 0,  ARENA_SIZE)
      default: return new THREE.Vector3( t, 0, -ARENA_SIZE)
    }
  }

  private spawnExplosionVfx(pos: THREE.Vector3, radius: number): void {
    const geo  = new THREE.SphereGeometry(radius * 0.5, 8, 8)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    this.scene.add(mesh)
    let life = 0.4
    const tick = () => {
      life -= 0.016
      mat.opacity   = Math.max(0, life / 0.4) * 0.7
      mesh.scale.setScalar(1 + (1 - life / 0.4) * 2)
      if (life > 0) requestAnimationFrame(tick)
      else this.scene.remove(mesh)
    }
    tick()
  }
}
