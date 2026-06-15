// Pure damage calculation functions matching the spec formula in Section 11.
export class DamageSystem {
  // Player's bullet hitting a zombie
  playerToZombie(
    baseDamage: number,
    headshotMultiplier: number,   // 1.0 if body shot
    upgradeMultiplier: number,
  ): number {
    return baseDamage * upgradeMultiplier * headshotMultiplier
  }

  // Zombie attacking player (accounts for armor)
  zombieToPlayer(
    baseDamage: number,
    armorReduction: number,       // 0.0 to 0.5
    armorDurability: number,
  ): { damageToPlayer: number; damageToArmor: number } {
    if (armorDurability <= 0) {
      return { damageToPlayer: baseDamage, damageToArmor: 0 }
    }
    const absorbed      = baseDamage * armorReduction
    const damageToArmor = Math.min(absorbed, armorDurability)
    const damageToPlayer = baseDamage - damageToArmor
    return { damageToPlayer, damageToArmor }
  }

  // Shotgun: sum pellet hits with distance falloff
  shotgunDamage(
    damagePerPellet: number,
    pelletsHit: number,
    upgradeMultiplier: number,
    distanceFalloff: number,  // 0.0 to 1.0
  ): number {
    return damagePerPellet * pelletsHit * upgradeMultiplier * distanceFalloff
  }
}
