import { create } from 'zustand'
import type { GamePhase } from '../types/game.types'

// Per-weapon upgrade levels (0–3 each)
export interface WeaponUpgrades {
  damage: number
  recoil: number
  mag:    number
  reload: number
}

const DEFAULT_WEAPON_UPGRADES: WeaponUpgrades = { damage: 0, recoil: 0, mag: 0, reload: 0 }

export interface ExplosiveUpgrades {
  grenadeDamage:   boolean
  grenadeRadius:   boolean
  molotovDuration: boolean
  molotovArea:     boolean
}

export interface ArmorState {
  id:              string
  durability:      number
  maxDurability:   number
  damageReduction: number
  speedPenalty:    number
  price:           number
}

interface GameStore {
  phase: GamePhase
  setPhase: (p: GamePhase) => void

  wave: number
  setWave: (w: number) => void
  zombiesRemaining: number
  setZombiesRemaining: (n: number) => void
  restTimer: number
  setRestTimer: (t: number) => void

  playerHp: number
  maxHp: number
  setPlayerHp: (hp: number) => void

  // Armor
  armor: ArmorState | null
  setArmor: (a: ArmorState | null) => void
  damageArmor: (amount: number) => void   // reduces durability

  // Stun
  stunTimer: number
  setStunTimer: (t: number) => void

  // Weapon slots
  activeSlot: 0 | 1
  setActiveSlot: (s: 0 | 1) => void
  isSwitching: boolean
  setIsSwitching: (v: boolean) => void
  slotWeaponNames: [string, string]
  setSlotWeaponName: (slot: 0 | 1, name: string) => void
  // Which weapon id occupies each slot (null = empty)
  slotWeaponIds: [string | null, string | null]
  setSlotWeaponId: (slot: 0 | 1, id: string | null) => void

  currentAmmo: number
  reserveAmmo: number
  isReloading: boolean
  updateAmmo: (cur: number, res: number) => void
  setReloading: (r: boolean) => void

  isScoped: boolean
  setScoped: (v: boolean) => void

  recoilSignal: number
  addRecoil: (amount: number) => void

  // Explosives
  grenadeCount: number
  molotovCount: number
  setGrenadeCount: (n: number) => void
  setMolotovCount: (n: number) => void

  // Economy
  currency: number
  setCurrency: (amount: number) => void
  addCurrency: (amount: number) => void
  spendCurrency: (amount: number) => boolean

  // Upgrades
  weaponUpgrades: Record<string, WeaponUpgrades>
  setWeaponUpgrade: (weaponId: string, type: keyof WeaponUpgrades, level: number) => void
  explosiveUpgrades: ExplosiveUpgrades
  setExplosiveUpgrade: (key: keyof ExplosiveUpgrades, value: boolean) => void

  // Consumables
  reviveTickets: number
  revivePurchaseCount: number          // how many bought — drives doubling price
  addReviveTicket: () => void
  useReviveTicket: () => void

  // Map unlocks
  unlockedZones: string[]
  unlockZone: (id: string) => void

  // Stats
  kills: number
  headshots: number
  incrementKills: () => void
  incrementHeadshots: () => void

  // Hit feedback (timestamp so CSS animation re-triggers each hit)
  lastHitTime: number
  setLastHitTime: (t: number) => void

  // Tab stats overlay toggle
  showStats: boolean
  setShowStats: (v: boolean) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'menu',
  setPhase: (p) => set({ phase: p }),

  wave: 0,
  setWave: (w) => set({ wave: w }),
  zombiesRemaining: 0,
  setZombiesRemaining: (n) => set({ zombiesRemaining: n }),
  restTimer: 0,
  setRestTimer: (t) => set({ restTimer: t }),

  playerHp: 100,
  maxHp: 100,
  setPlayerHp: (hp) => set({ playerHp: hp }),

  armor: null,
  setArmor: (a) => set({ armor: a }),
  damageArmor: (amount) => set((s) => {
    if (!s.armor) return {}
    const newDur = Math.max(0, s.armor.durability - amount)
    return { armor: newDur > 0 ? { ...s.armor, durability: newDur } : null }
  }),

  stunTimer: 0,
  setStunTimer: (t) => set({ stunTimer: t }),

  activeSlot: 0,
  setActiveSlot: (s) => set({ activeSlot: s }),
  isSwitching: false,
  setIsSwitching: (v) => set({ isSwitching: v }),
  slotWeaponNames: ['PISTOL', '—'],
  setSlotWeaponName: (slot, name) =>
    set((s) => { const n = [...s.slotWeaponNames] as [string, string]; n[slot] = name; return { slotWeaponNames: n } }),
  slotWeaponIds: ['pistol', null],
  setSlotWeaponId: (slot, id) =>
    set((s) => { const n = [...s.slotWeaponIds] as [string|null, string|null]; n[slot] = id; return { slotWeaponIds: n } }),

  currentAmmo: 14,
  reserveAmmo: 28,
  isReloading: false,
  updateAmmo: (cur, res) => set({ currentAmmo: cur, reserveAmmo: res }),
  setReloading: (r) => set({ isReloading: r }),

  isScoped: false,
  setScoped: (v) => set({ isScoped: v }),

  recoilSignal: 0,
  addRecoil: () => set((s) => ({ recoilSignal: s.recoilSignal + 1 })),

  grenadeCount: 3,
  molotovCount: 2,
  setGrenadeCount: (n) => set({ grenadeCount: n }),
  setMolotovCount: (n) => set({ molotovCount: n }),

  currency: 0,
  setCurrency: (amount) => set({ currency: amount }),
  addCurrency: (amount) => set((s) => ({ currency: s.currency + amount })),
  spendCurrency: (amount) => {
    const { currency } = get()
    if (currency < amount) return false
    set({ currency: currency - amount })
    return true
  },

  weaponUpgrades: {
    pistol:  { ...DEFAULT_WEAPON_UPGRADES },
    rifle:   { ...DEFAULT_WEAPON_UPGRADES },
    shotgun: { ...DEFAULT_WEAPON_UPGRADES },
    sniper:  { ...DEFAULT_WEAPON_UPGRADES },
  },
  setWeaponUpgrade: (weaponId, type, level) =>
    set((s) => ({
      weaponUpgrades: {
        ...s.weaponUpgrades,
        [weaponId]: { ...s.weaponUpgrades[weaponId], [type]: level },
      },
    })),
  explosiveUpgrades: {
    grenadeDamage: false, grenadeRadius: false,
    molotovDuration: false, molotovArea: false,
  },
  setExplosiveUpgrade: (key, value) =>
    set((s) => ({ explosiveUpgrades: { ...s.explosiveUpgrades, [key]: value } })),

  reviveTickets: 0,
  revivePurchaseCount: 0,
  addReviveTicket: () => set((s) => ({ reviveTickets: s.reviveTickets + 1, revivePurchaseCount: s.revivePurchaseCount + 1 })),
  useReviveTicket: () => set((s) => ({ reviveTickets: Math.max(0, s.reviveTickets - 1) })),

  unlockedZones: [],
  unlockZone: (id) => set((s) => ({ unlockedZones: [...s.unlockedZones, id] })),

  kills: 0,
  headshots: 0,
  incrementKills: () => set((s) => ({ kills: s.kills + 1 })),
  incrementHeadshots: () => set((s) => ({ headshots: s.headshots + 1 })),

  lastHitTime: 0,
  setLastHitTime: (t) => set({ lastHitTime: t }),

  showStats: false,
  setShowStats: (v) => set({ showStats: v }),
}))
