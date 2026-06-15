import * as THREE from 'three'
import { Pistol }  from './Pistol'
import { Rifle }   from './Rifle'
import { Shotgun } from './Shotgun'
import { Sniper }  from './Sniper'
import type { Weapon } from './Weapon'
import type { HitResult } from './Weapon'
import type { InputManager } from '../../core/InputManager'
import type { FPSCamera } from '../player/Camera'
import { useGameStore } from '../../ui/store'
import weaponsData from '../../data/weapons.json'
import type { WeaponDef } from '../../types/weapon.types'

const SWITCH_TIME = 1.5  // seconds

// Maps weapon id → constructor factory
type WeaponFactory = (def: WeaponDef, camera: THREE.PerspectiveCamera, scene: THREE.Scene, input: InputManager) => Weapon

// Manages two weapon slots, switching cooldown, and delegates fire/reload to the active weapon.
export class WeaponSlotManager {
  private slots: [Weapon | null, Weapon | null] = [null, null]
  private activeSlot: 0 | 1 = 0
  private switchTimer = 0
  private isSwitching = false

  private camera: FPSCamera
  private scene: THREE.Scene
  private input: InputManager
  private defs: Map<string, WeaponDef>

  constructor(fpsCam: FPSCamera, scene: THREE.Scene, input: InputManager) {
    this.camera = fpsCam
    this.scene  = scene
    this.input  = input

    this.defs = new Map(
      (weaponsData.weapons as WeaponDef[]).map(w => [w.id, w])
    )
  }

  // Equip a weapon by id into a slot. Called from EconomySystem on purchase.
  equip(slot: 0 | 1, weaponId: string): void {
    const def = this.defs.get(weaponId)
    if (!def) return

    const weapon = this.buildWeapon(def)
    this.slots[slot] = weapon

    const store = useGameStore.getState()
    store.setSlotWeaponName(slot, def.name.toUpperCase())
    store.setSlotWeaponId(slot, weaponId)
    if (slot === this.activeSlot) {
      this.syncAmmoToStore()
    }
  }

  // Apply precomputed upgrade multipliers to any slot weapon matching weaponId.
  applyUpgrades(
    weaponId: string,
    upgradeMultiplier: number,
    reloadSpeedMult: number,
    magBonus: number,
    recoilMult: number,
  ): void {
    for (const w of this.slots) {
      if (w && w.id === weaponId) {
        w.upgradeMultiplier = upgradeMultiplier
        w.reloadSpeedMult   = reloadSpeedMult
        w.magBonus          = magBonus
        w.recoilMult        = recoilMult
      }
    }
  }

  private buildWeapon(def: WeaponDef): Weapon {
    const cam   = this.camera.camera
    const scene = this.scene
    const input = this.input

    const factories: Record<string, WeaponFactory> = {
      pistol:  (d, c, s, i) => new Pistol(d, c, s, i),
      rifle:   (d, c, s, i) => new Rifle(d, c, s, i),
      shotgun: (d, c, s, i) => new Shotgun(d, c, s, i),
      sniper:  (d, c, s, i) => new Sniper(d, c, s, i, (fov) => this.camera.setFOV(fov)),
    }

    const factory = factories[def.id] ?? factories['pistol']
    return factory(def, cam, scene, input)
  }

  getActive(): Weapon | null {
    return this.slots[this.activeSlot]
  }

  update(dt: number): HitResult[] {
    // Switch cooldown
    if (this.isSwitching) {
      this.switchTimer -= dt
      if (this.switchTimer <= 0) {
        this.isSwitching = false
        useGameStore.getState().setIsSwitching(false)
        this.syncAmmoToStore()
      }
      return []  // can't fire while switching
    }

    // Key 1 / Key 2 to switch slots
    if (this.input.justPressed('Digit1') && this.activeSlot !== 0) this.switchTo(0)
    if (this.input.justPressed('Digit2') && this.activeSlot !== 1 && this.slots[1]) this.switchTo(1)

    const weapon = this.getActive()
    if (!weapon) return []
    return weapon.update(dt)
  }

  private switchTo(slot: 0 | 1): void {
    this.activeSlot  = slot
    this.isSwitching = true
    this.switchTimer = SWITCH_TIME

    const store = useGameStore.getState()
    store.setActiveSlot(slot)
    store.setIsSwitching(true)
    // Show empty ammo during switch
    store.updateAmmo(0, 0)
    store.setReloading(false)
  }

  private syncAmmoToStore(): void {
    const w = this.getActive()
    if (!w) return
    useGameStore.getState().updateAmmo(w.currentAmmo, w.reserveAmmo)
    useGameStore.getState().setReloading(w.isReloading)
  }
}
