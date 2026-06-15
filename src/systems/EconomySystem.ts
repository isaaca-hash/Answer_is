import shopData      from '../data/shop.json'
import weaponsData   from '../data/weapons.json'
import explosivesData from '../data/explosives.json'
import { useGameStore } from '../ui/store'
import type { WeaponUpgrades, ExplosiveUpgrades } from '../ui/store'
import type { WeaponSlotManager } from '../entities/weapons/WeaponSlotManager'
import type { ExplosiveManager }  from '../entities/weapons/ExplosiveManager'

type WeaponUpgradeId = keyof typeof shopData.weapon_upgrades

// Module-level singleton so ShopUI can reach EconomySystem without prop-drilling.
let _economy: EconomySystem | null = null
export function initEconomy(e: EconomySystem): void { _economy = e }
export function getEconomy(): EconomySystem | null   { return _economy }

export class EconomySystem {
  constructor(
    private slots:     WeaponSlotManager,
    private explosives: ExplosiveManager,
  ) {}

  buyWeapon(slot: 0 | 1, weaponId: string): boolean {
    const def = (weaponsData.weapons as Array<{ id: string; price: number }>).find(w => w.id === weaponId)
    if (!def) return false
    if (!useGameStore.getState().spendCurrency(def.price)) return false
    this.slots.equip(slot, weaponId)
    this.propagateWeaponUpgrades(weaponId)
    return true
  }

  buyArmor(armorId: string): boolean {
    const def = shopData.armor.find(a => a.id === armorId)
    if (!def) return false
    if (!useGameStore.getState().spendCurrency(def.price)) return false
    useGameStore.getState().setArmor({
      id:              def.id,
      durability:      def.durability,
      maxDurability:   def.durability,
      damageReduction: def.damage_reduction,
      speedPenalty:    def.speed_penalty,
      price:           def.price,
    })
    return true
  }

  repairArmor(): boolean {
    const store = useGameStore.getState()
    const { armor } = store
    if (!armor) return false
    if (armor.durability >= armor.maxDurability) return false
    const cost = Math.ceil(armor.price * shopData.armor_repair_cost_fraction)
    if (!store.spendCurrency(cost)) return false
    store.setArmor({ ...armor, durability: armor.maxDurability })
    return true
  }

  buyConsumable(id: string): boolean {
    const store = useGameStore.getState()

    if (id === 'sage_orb') {
      const { price, hp_amount } = shopData.consumables.sage_orb
      if (!store.spendCurrency(price)) return false
      store.setPlayerHp(Math.min(store.maxHp, store.playerHp + hp_amount))
      return true
    }

    if (id === 'revive_ticket') {
      const { price_progression } = shopData.consumables.revive_ticket
      const idx   = Math.min(store.revivePurchaseCount, price_progression.length - 1)
      const price = price_progression[idx]
      if (!store.spendCurrency(price)) return false
      store.addReviveTicket()
      return true
    }

    return false
  }

  buyWeaponUpgrade(weaponId: string, type: keyof WeaponUpgrades): boolean {
    const store    = useGameStore.getState()
    const upgrades = store.weaponUpgrades[weaponId]
    if (!upgrades) return false

    const currentLevel = upgrades[type]
    if (currentLevel >= 3) return false

    const cfg = shopData.weapon_upgrades[weaponId as WeaponUpgradeId]
    if (!cfg) return false

    if (!store.spendCurrency(cfg.prices[currentLevel])) return false
    store.setWeaponUpgrade(weaponId, type, currentLevel + 1)
    this.propagateWeaponUpgrades(weaponId)
    return true
  }

  buyExplosiveUpgrade(key: keyof ExplosiveUpgrades): boolean {
    const store = useGameStore.getState()
    if (store.explosiveUpgrades[key]) return false

    const idMap: Record<keyof ExplosiveUpgrades, string> = {
      grenadeDamage:   'grenade_damage',
      grenadeRadius:   'grenade_radius',
      molotovDuration: 'molotov_duration',
      molotovArea:     'molotov_area',
    }

    const def = shopData.explosive_upgrades.find(e => e.id === idMap[key])
    if (!def) return false
    if (!store.spendCurrency(def.price)) return false

    store.setExplosiveUpgrade(key, true)
    this.applyExplosiveUpgrade(key)
    return true
  }

  buyMapUnlock(id: string): boolean {
    const store = useGameStore.getState()
    if (store.unlockedZones.includes(id)) return false

    const def = shopData.map_unlocks.find(m => m.id === id)
    if (!def) return false
    if (!store.spendCurrency(def.cost)) return false

    store.unlockZone(id)
    return true
  }

  private propagateWeaponUpgrades(weaponId: string): void {
    const store    = useGameStore.getState()
    const upgrades = store.weaponUpgrades[weaponId]
    if (!upgrades) return

    const cfg = shopData.weapon_upgrades[weaponId as WeaponUpgradeId]
    if (!cfg) return

    const { reload_speed_reduction_pct_per_level, recoil_reduction_pct_per_level } = shopData.other_upgrades

    this.slots.applyUpgrades(
      weaponId,
      1 + upgrades.damage * cfg.damage_pct,
      1 - upgrades.reload  * reload_speed_reduction_pct_per_level,
      upgrades.mag * cfg.mag_bonus,
      1 - upgrades.recoil  * recoil_reduction_pct_per_level,
    )
  }

  private applyExplosiveUpgrade(key: keyof ExplosiveUpgrades): void {
    const molotov = explosivesData.explosives.find(e => e.id === 'molotov')!
    switch (key) {
      case 'grenadeDamage':
        this.explosives.grenadeDamageMult   = 1.5
        break
      case 'grenadeRadius':
        this.explosives.grenadeRadiusMult   = 1.5
        break
      case 'molotovDuration':
        this.explosives.molotovDurationMult = (molotov.duration + 3) / molotov.duration
        break
      case 'molotovArea':
        this.explosives.molotovAreaMult     = 1.5
        break
    }
  }
}
