export type AttackType = 'melee' | 'melee_charge' | 'melee_heavy' | 'suicide_explosion' | 'ranged'

export interface ZombieChargeData {
  damage: number
  stun_duration: number
  charge_speed: number
  charge_cooldown: number
  telegraph_time: number
}

export interface ZombieExplosionData {
  trigger_range: number
  damage: number
  radius: number
}

export interface ZombieRangedData {
  fire_rate: number
  burst_count: number
  burst_cooldown: number
  projectile_speed: number
  accuracy: number
}

export interface ZombieSummonAbility {
  trigger_hp_threshold: number
  summon_id: string
  summon_count: number
}

export interface ZombieWeakPoint {
  part: string
  damage_multiplier: number
}

export interface ZombiePhase2 {
  trigger_hp: number
  summon_interval: number
  summon_pool: string[]
  summon_count_each: number
}

export interface ZombieDef {
  id: string
  name: string
  hp: number
  speed: number
  damage: number
  attack_type: AttackType
  attack_range: number
  attack_cooldown: number
  drop_currency: number
  spawn_wave: number
  weight: number
  is_boss?: boolean
  max_concurrent?: number
  charge?: ZombieChargeData
  explosion?: ZombieExplosionData
  ranged?: ZombieRangedData
  summon_ability?: ZombieSummonAbility
  weak_point?: ZombieWeakPoint
  phase_2?: ZombiePhase2
}

export interface ZombieScalingConfig {
  health_increase_per_wave: number
  damage_increase_per_wave: number
}

export interface ZombiesConfig {
  zombies: ZombieDef[]
  scaling: ZombieScalingConfig
}

// Runtime scaled stats (computed each wave)
export interface ScaledZombieStats {
  hp: number
  damage: number
  speed: number
}
