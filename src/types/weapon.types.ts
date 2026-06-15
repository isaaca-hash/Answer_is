export type FireMode = 'semi' | 'auto' | 'pump' | 'bolt'
export type RecoilLevel = 'low' | 'medium' | 'high'
export type ReloadType = 'magazine' | 'per_shell'

export interface WeaponDef {
  id: string
  name: string
  starter: boolean
  price: number
  damage: number
  pellets?: number
  rpm: number
  recoil: RecoilLevel
  recoil_value: number
  mag_size: number
  max_mags: number
  starting_mags: number
  reload_time: number
  reload_type?: ReloadType
  fire_mode: FireMode
  headshot_multiplier: number
  effective_range: number
  scope_zoom?: number
  penetration?: number
  damage_falloff_start?: number
  damage_falloff_end?: number
}

export interface WeaponCommonRules {
  weapon_slots: number
  weapon_switch_time: number
  starter_weapon: string
}

export interface WeaponsConfig {
  weapons: WeaponDef[]
  common_rules: WeaponCommonRules
}

// Runtime weapon state (upgrades applied on top of def)
export interface WeaponState {
  defId: string
  currentAmmo: number
  reserveAmmo: number
  isReloading: boolean
  reloadProgress: number
  upgradeLevel: number
  damageMultiplier: number
  recoilMultiplier: number
  magSizeBonus: number
  reloadSpeedMultiplier: number
}
