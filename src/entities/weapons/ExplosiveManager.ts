import * as THREE from 'three'
import type { InputManager } from '../../core/InputManager'
import type { FPSCamera } from '../player/Camera'
import type { SpawnManager } from '../../systems/SpawnManager'
import { useGameStore } from '../../ui/store'
import explosivesData from '../../data/explosives.json'
import { AudioManager } from '../../core/AudioManager'

interface ActiveGrenade {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  fuseTimer: number
  damage: number
  radius: number
}

interface FirePool {
  mesh: THREE.Mesh
  center: THREE.Vector3
  radius: number
  dotDps: number
  lifetime: number
  tickTimer: number
}

// Manages thrown grenades and molotovs: physics arcs, explosions, fire pools.
export class ExplosiveManager {
  private scene:          THREE.Scene
  private camera:         FPSCamera
  private input:          InputManager
  private spawn:          SpawnManager
  private onZombieKilled: () => void

  private grenades:  ActiveGrenade[] = []
  private firePools: FirePool[]      = []

  private grenadeDef = explosivesData.explosives.find(e => e.id === 'grenade')!
  private molotovDef = explosivesData.explosives.find(e => e.id === 'molotov')!

  // Upgrade multipliers (will be applied by EconomySystem in Stage 4)
  grenadeRadiusMult  = 1.0
  grenadeDamageMult  = 1.0
  molotovDurationMult = 1.0
  molotovAreaMult    = 1.0

  constructor(
    scene: THREE.Scene,
    camera: FPSCamera,
    input: InputManager,
    spawn: SpawnManager,
    onZombieKilled: () => void,
  ) {
    this.scene          = scene
    this.camera         = camera
    this.input          = input
    this.spawn          = spawn
    this.onZombieKilled = onZombieKilled
  }

  update(dt: number): void {
    const store = useGameStore.getState()

    const audio = AudioManager.getInstance()

    // G → throw grenade
    if (this.input.justPressed('KeyG') && store.grenadeCount > 0) {
      this.throwGrenade()
      store.setGrenadeCount(store.grenadeCount - 1)
      audio.play('grenade_throw')
    }

    // F → throw molotov
    if (this.input.justPressed('KeyF') && store.molotovCount > 0) {
      this.throwMolotov()
      store.setMolotovCount(store.molotovCount - 1)
      audio.play('molotov_throw')
    }

    this.updateGrenades(dt)
    this.updateFirePools(dt)
  }

  private throwGrenade(): void {
    const origin = this.camera.getWorldPosition()
    const dir    = this.camera.getWorldDirection()

    // Throw velocity: forward + upward arc
    const velocity = dir.clone().multiplyScalar(12)
    velocity.y += 4

    const geo  = new THREE.SphereGeometry(0.12, 6, 6)
    const mat  = new THREE.MeshStandardMaterial({ color: 0x556b2f })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(origin).addScaledVector(dir, 0.6)
    this.scene.add(mesh)

    this.grenades.push({
      mesh,
      velocity,
      fuseTimer: this.grenadeDef.fuse_time,
      damage:    this.grenadeDef.damage  * this.grenadeDamageMult,
      radius:    this.grenadeDef.radius  * this.grenadeRadiusMult,
    })
  }

  private throwMolotov(): void {
    const origin = this.camera.getWorldPosition()
    const dir    = this.camera.getWorldDirection()

    // Molotov follows same arc as grenade but lands on ground
    const velocity = dir.clone().multiplyScalar(10)
    velocity.y += 3

    const geo  = new THREE.SphereGeometry(0.1, 6, 6)
    const mat  = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff2200, emissiveIntensity: 0.4 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(origin).addScaledVector(dir, 0.6)
    this.scene.add(mesh)

    // Reuse grenade struct for flight; resolve as molotov on ground
    this.grenades.push({
      mesh,
      velocity,
      fuseTimer: 10,  // long fuse — triggers on ground contact instead
      damage:    this.molotovDef.instant_damage,
      radius:    this.molotovDef.radius * this.molotovAreaMult,
    })
    // Tag so we know it's a molotov
    mesh.userData['isMolotov'] = true
    mesh.userData['dotDps']    = this.molotovDef.dot_damage / this.molotovDef.duration
    mesh.userData['duration']  = this.molotovDef.duration   * this.molotovDurationMult
    mesh.userData['dotRadius'] = this.molotovDef.radius     * this.molotovAreaMult
  }

  private updateGrenades(dt: number): void {
    const toRemove: ActiveGrenade[] = []

    for (const g of this.grenades) {
      // Gravity
      g.velocity.y -= 18 * dt
      g.mesh.position.addScaledVector(g.velocity, dt)
      g.fuseTimer -= dt

      // Ground contact or fuse expiry → explode
      const hitGround = g.mesh.position.y <= 0.1
      const fuseUp    = g.fuseTimer <= 0

      if (hitGround || fuseUp) {
        g.mesh.position.y = 0
        if (g.mesh.userData['isMolotov']) {
          this.createFirePool(g)
        } else {
          this.explodeGrenade(g)
        }
        this.scene.remove(g.mesh)
        toRemove.push(g)
      }
    }

    this.grenades = this.grenades.filter(g => !toRemove.includes(g))
  }

  private explodeGrenade(g: ActiveGrenade): void {
    AudioManager.getInstance().play('explosion')
    this.spawnExplosionVfx(g.mesh.position, g.radius)
    this.damageZombiesInRadius(g.mesh.position, g.radius, g.damage)
  }

  private createFirePool(g: ActiveGrenade): void {
    AudioManager.getInstance().play('molotov_land')
    const radius   = g.mesh.userData['dotRadius'] as number
    const dotDps   = g.mesh.userData['dotDps']    as number
    const duration = g.mesh.userData['duration']  as number

    // Instant damage on impact
    this.damageZombiesInRadius(g.mesh.position, radius, g.damage)

    // Fire disc
    const geo  = new THREE.CircleGeometry(radius, 16)
    const mat  = new THREE.MeshBasicMaterial({
      color: 0xff3300, transparent: true, opacity: 0.65,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.copy(g.mesh.position)
    mesh.position.y = 0.05
    this.scene.add(mesh)

    this.firePools.push({
      mesh,
      center: g.mesh.position.clone(),
      radius,
      dotDps,
      lifetime:  duration,
      tickTimer: 0.5,  // deal DOT every 0.5s
    })
  }

  private updateFirePools(dt: number): void {
    const toRemove: FirePool[] = []

    for (const fp of this.firePools) {
      fp.lifetime  -= dt
      fp.tickTimer -= dt

      if (fp.tickTimer <= 0) {
        fp.tickTimer = 0.5
        // DOT: damage per 0.5s tick = dotDps * 0.5
        this.damageZombiesInRadius(fp.center, fp.radius, fp.dotDps * 0.5)
      }

      // Fade out as fire dies
      const mat = fp.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.65 * Math.max(0, fp.lifetime / 5)

      if (fp.lifetime <= 0) {
        this.scene.remove(fp.mesh)
        toRemove.push(fp)
      }
    }

    this.firePools = this.firePools.filter(fp => !toRemove.includes(fp))
  }

  private damageZombiesInRadius(center: THREE.Vector3, radius: number, damage: number): void {
    const store   = useGameStore.getState()
    const zombies = this.spawn.getZombiesInRadius(center, radius)
    for (const z of zombies) {
      const died = z.takeDamage(damage)
      if (died) {
        store.addCurrency(z.def.drop_currency)
        store.incrementKills()
        this.spawn.releaseZombie(z)
        this.onZombieKilled()
      }
    }
  }

  private spawnExplosionVfx(pos: THREE.Vector3, radius: number): void {
    const geo  = new THREE.SphereGeometry(radius * 0.4, 8, 8)
    const mat  = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    this.scene.add(mesh)

    let life = 0.3
    const tick = () => {
      life -= 0.016
      const mat2 = mesh.material as THREE.MeshBasicMaterial
      mat2.opacity = Math.max(0, life / 0.3) * 0.8
      mesh.scale.setScalar(1 + (1 - life / 0.3) * 1.5)
      if (life > 0) requestAnimationFrame(tick)
      else this.scene.remove(mesh)
    }
    tick()
  }
}
