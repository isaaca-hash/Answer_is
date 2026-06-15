import * as THREE from 'three'
import { InputManager } from './InputManager'
import { AudioManager } from './AudioManager'
import { FPSCamera } from '../entities/player/Camera'
import { Movement } from '../entities/player/Movement'
import { BoxMap } from '../entities/BoxMap'
import { WeaponSlotManager } from '../entities/weapons/WeaponSlotManager'
import { ExplosiveManager } from '../entities/weapons/ExplosiveManager'
import { SpawnManager } from '../systems/SpawnManager'
import { WaveManager } from '../systems/WaveManager'
import { DamageSystem } from '../systems/DamageSystem'
import { EconomySystem, initEconomy } from '../systems/EconomySystem'
import { ParticleSystem } from '../systems/ParticleSystem'
import { useGameStore } from '../ui/store'

export class Game {
  private renderer:   THREE.WebGLRenderer
  private scene:      THREE.Scene
  private input:      InputManager
  private audio:      AudioManager
  private camera:     FPSCamera
  private movement:   Movement
  private map:        BoxMap
  private weapons:    WeaponSlotManager
  private explosives: ExplosiveManager
  private spawn:      SpawnManager
  private waves:      WaveManager
  private damage:     DamageSystem
  private economy:    EconomySystem
  private particles:  ParticleSystem
  private clock       = new THREE.Clock()
  private animFrameId = 0
  private running     = false
  private prevPhase   = 'menu'

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a0a00)
    this.scene.fog = new THREE.Fog(0x1a0a00, 20, 80)

    this.setupLights()

    this.input     = InputManager.getInstance()
    this.audio     = AudioManager.getInstance()
    this.camera    = new FPSCamera(canvas)
    this.scene.add(this.camera.object)

    this.movement  = new Movement(this.camera, this.input)
    this.map       = new BoxMap(this.scene)

    this.weapons = new WeaponSlotManager(this.camera, this.scene, this.input)
    this.weapons.equip(0, 'pistol')
    this.weapons.equip(1, 'rifle')

    this.damage     = new DamageSystem()
    this.particles  = new ParticleSystem(this.scene)
    this.spawn      = new SpawnManager(this.scene)

    this.spawn.onPlayerDamage = (dmg) => this.applyDamageToPlayer(dmg)

    this.waves = new WaveManager(this.spawn, this.scene)

    this.explosives = new ExplosiveManager(
      this.scene, this.camera, this.input, this.spawn,
      () => this.waves.onZombieKilled(),
    )

    this.economy = new EconomySystem(this.weapons, this.explosives)
    initEconomy(this.economy)

    window.addEventListener('resize', this.onResize)
  }

  private setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0x331a00, 0.4))

    const sun = new THREE.DirectionalLight(0xff6633, 1.2)
    sun.position.set(10, 20, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near   = 0.5
    sun.shadow.camera.far    = 100
    sun.shadow.camera.left   = sun.shadow.camera.bottom = -30
    sun.shadow.camera.right  = sun.shadow.camera.top   =  30
    this.scene.add(sun)
  }

  start(): void {
    this.running = true
    this.waves.startWave(1)
    this.audio.playBGM()
    this.clock.start()
    this.loop()
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.animFrameId)
    this.audio.stopBGM()
  }

  private loop = (): void => {
    if (!this.running) return
    this.animFrameId = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.update(dt)
    this.renderer.render(this.scene, this.camera.camera)
    this.input.flushFrame()
  }

  private update(dt: number): void {
    const store = useGameStore.getState()
    const { phase } = store

    // ── ESC: toggle pause (checked before early-exit so it works while paused) ──
    if (this.input.justPressed('Escape')) {
      if (phase === 'playing') {
        store.setPhase('paused')
        document.exitPointerLock()
      } else if (phase === 'paused') {
        store.setPhase('playing')
      }
      return
    }

    // ── Tab: show/hide stats overlay ──
    const tabDown = this.input.isDown('Tab')
    if (tabDown !== store.showStats) store.setShowStats(tabDown)

    // ── Phase transitions ──
    if (phase !== this.prevPhase) {
      if (phase === 'wave_rest') document.exitPointerLock()
      this.prevPhase = phase
    }

    if (phase === 'paused' || phase === 'game_over') return

    // Stun timer and wave countdown always tick
    if (store.stunTimer > 0) store.setStunTimer(Math.max(0, store.stunTimer - dt))
    this.waves.update(dt)
    this.particles.update(dt)

    if (phase !== 'playing') return

    this.movement.update(dt, this.map.getColliders())
    this.camera.update(this.input, dt)

    // Weapon hits
    const hitResults = this.weapons.update(dt)
    for (const hit of hitResults) {
      const zombie = this.spawn.getZombieAt(hit.point)
      if (!zombie) {
        // Bullet hit environment — spark only
        this.particles.spawnHitSpark(hit.point)
        continue
      }

      const zombieWeakMult = hit.isHeadshot && zombie.def.weak_point
        ? zombie.def.weak_point.damage_multiplier : 1.0

      const finalDmg = this.damage.playerToZombie(
        hit.damage,
        hit.isHeadshot ? hit.headshotMultiplier * zombieWeakMult : 1.0,
        1.0,
      )

      // Blood on hit
      this.particles.spawnBlood(hit.point)
      this.audio.play('zombie_hit', 0.5)

      const died = zombie.takeDamage(finalDmg)
      if (died) {
        // Death dust at zombie feet
        const feetPos = zombie.mesh.position.clone()
        this.particles.spawnDeathDust(feetPos)
        this.audio.play('zombie_die', 0.6)

        store.addCurrency(zombie.def.drop_currency)
        store.incrementKills()
        if (hit.isHeadshot) store.incrementHeadshots()
        this.spawn.releaseZombie(zombie)
        this.waves.onZombieKilled()
      }
    }

    this.explosives.update(dt)

    // Zombie AI
    const playerPos = this.movement.getPosition()
    const attacks   = this.spawn.update(dt, playerPos)
    for (const dmg of attacks) {
      this.applyDamageToPlayer(dmg)
      if (useGameStore.getState().phase === 'game_over') return
    }
  }

  private applyDamageToPlayer(baseDmg: number): void {
    const store = useGameStore.getState()
    const { armor } = store

    const { damageToPlayer, damageToArmor } = this.damage.zombieToPlayer(
      baseDmg,
      armor ? armor.damageReduction : 0,
      armor ? armor.durability : 0,
    )
    if (armor && damageToArmor > 0) store.damageArmor(damageToArmor)

    const newHp = store.playerHp - damageToPlayer
    store.setPlayerHp(Math.max(0, newHp))
    store.setLastHitTime(Date.now())
    this.audio.play('player_hit', 0.8)

    if (newHp <= 0) {
      if (store.reviveTickets > 0) {
        store.useReviveTicket()
        store.setPlayerHp(50)
      } else {
        store.setPhase('game_over')
      }
    }
  }

  private onResize = (): void => {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.camera.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.camera.updateProjectionMatrix()
  }

  dispose(): void {
    this.stop()
    window.removeEventListener('resize', this.onResize)
    this.particles.dispose()
    this.camera.dispose()
    this.renderer.dispose()
  }
}
