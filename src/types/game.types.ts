export type GamePhase = 'menu' | 'playing' | 'wave_rest' | 'shop' | 'paused' | 'game_over'
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface DifficultyConfig {
  zombie_hp_multiplier: number
  zombie_damage_multiplier: number
  currency_multiplier: number
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy:   { zombie_hp_multiplier: 0.7,  zombie_damage_multiplier: 0.7,  currency_multiplier: 1.5 },
  normal: { zombie_hp_multiplier: 1.0,  zombie_damage_multiplier: 1.0,  currency_multiplier: 1.0 },
  hard:   { zombie_hp_multiplier: 1.5,  zombie_damage_multiplier: 1.3,  currency_multiplier: 1.0 },
}

// Computes zombie count for a given wave (from the spec formula)
export function zombieCountForWave(wave: number): number {
  return Math.floor(5 + wave * (2 + wave * 0.1))
}

export interface ArmorState {
  id: string
  durability: number
  maxDurability: number
  damageReduction: number
  speedPenalty: number
}

export interface PlayerState {
  hp: number
  maxHp: number
  armor: ArmorState | null
  currency: number
  speed: number
  dashStamina: number
  maxDashStamina: number
  reviveCount: number
}

export interface GameStats {
  wave: number
  killCount: number
  headshotCount: number
  totalDamageDealt: number
  currencySpent: number
}
