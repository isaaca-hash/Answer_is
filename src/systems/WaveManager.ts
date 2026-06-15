import * as THREE from 'three'
import type { SpawnManager } from './SpawnManager'
import { zombieCountForWave } from '../types/game.types'
import { useGameStore } from '../ui/store'
import zombiesData from '../data/zombies.json'
import type { ZombieScalingConfig } from '../types/zombie.types'

const REST_DURATION       = 15
const FOG_TOGGLE_INTERVAL = 10
const BOSS_INTERVAL       = 10  // boss every 10th wave

export class WaveManager {
  private spawn:        SpawnManager
  private scene:        THREE.Scene
  private currentWave   = 0
  private zombiesRemaining = 0
  private restTimer     = 0
  private inRest        = false
  private fogEnabled    = false
  private scaling: ZombieScalingConfig

  constructor(spawn: SpawnManager, scene: THREE.Scene) {
    this.spawn   = spawn
    this.scene   = scene
    this.scaling = (zombiesData as { scaling: ZombieScalingConfig }).scaling

    // Wire SpawnManager callbacks back to WaveManager
    this.spawn.onZombieKilled = () => this.onZombieKilled()
  }

  startWave(wave: number): void {
    this.currentWave     = wave
    this.inRest          = false
    const isBossWave     = wave % BOSS_INTERVAL === 0

    // Fog toggle every 10 waves
    if (wave % FOG_TOGGLE_INTERVAL === 0) {
      this.fogEnabled = !this.fogEnabled
      this.scene.fog  = this.fogEnabled
        ? new THREE.Fog(0x1a0a00, 5, 15)
        : new THREE.Fog(0x1a0a00, 20, 80)
    }

    const count = zombieCountForWave(wave)

    if (isBossWave) {
      this.zombiesRemaining = 1 + Math.floor(count * 0.5)
      this.spawn.spawnBossWave(wave)
    } else {
      this.zombiesRemaining = count
      this.spawn.spawnWave(count, wave)
    }

    const store = useGameStore.getState()
    store.setWave(wave)
    store.setZombiesRemaining(this.zombiesRemaining)
    store.setPhase('playing')
    store.setRestTimer(0)
  }

  onZombieKilled(): void {
    this.zombiesRemaining = Math.max(0, this.zombiesRemaining - 1)
    useGameStore.getState().setZombiesRemaining(this.zombiesRemaining)

    if (this.zombiesRemaining === 0 && !this.inRest) this.beginRest()
  }

  update(dt: number): void {
    if (!this.inRest) return
    this.restTimer -= dt
    useGameStore.getState().setRestTimer(Math.max(0, this.restTimer))

    if (this.restTimer <= 0) {
      useGameStore.getState().addCurrency(this.currentWave * 5)
      this.startWave(this.currentWave + 1)
    }
  }

  private beginRest(): void {
    this.inRest      = true
    this.restTimer   = REST_DURATION
    useGameStore.getState().setPhase('wave_rest')
    useGameStore.getState().setRestTimer(REST_DURATION)
  }
}
