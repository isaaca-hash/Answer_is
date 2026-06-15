import { useState } from 'react'
import { useGameStore } from '../store'
import type { WeaponUpgrades } from '../store'
import { getEconomy } from '../../systems/EconomySystem'
import shopData     from '../../data/shop.json'
import weaponsData  from '../../data/weapons.json'

type Tab = 'weapons' | 'armor' | 'consumables' | 'upgrades' | 'map'

const TABS: { id: Tab; label: string }[] = [
  { id: 'weapons',     label: 'Weapons' },
  { id: 'armor',       label: 'Armor' },
  { id: 'consumables', label: 'Consumables' },
  { id: 'upgrades',    label: 'Upgrades' },
  { id: 'map',         label: 'Map' },
]

const NON_STARTER_WEAPONS = (weaponsData.weapons as Array<{
  id: string; name: string; price: number; starter?: boolean;
  damage: number; rpm: number; mag_size: number
}>).filter(w => !w.starter)

const UPGRADE_LABELS: Record<keyof WeaponUpgrades, string> = {
  damage: 'Damage',
  recoil: 'Recoil',
  mag:    'Mag Size',
  reload: 'Reload Spd',
}

const WEAPON_IDS_WITH_UPGRADES = ['pistol', 'rifle', 'shotgun', 'sniper'] as const
type UpgWeaponId = typeof WEAPON_IDS_WITH_UPGRADES[number]

export function ShopUI() {
  const { phase, currency, restTimer, armor, weaponUpgrades, explosiveUpgrades, revivePurchaseCount, playerHp, maxHp } = useGameStore()
  const [tab, setTab] = useState<Tab>('weapons')

  if (phase !== 'wave_rest') return null

  const eco = getEconomy()
  const buy = (fn: () => boolean | undefined) => { fn?.(); }

  return (
    <div style={s.overlay}>
      <div style={s.panel}>

        {/* Header */}
        <div style={s.header}>
          <span style={s.shopTitle}>SHOP</span>
          <span style={s.timer}>Next wave in {Math.ceil(restTimer)}s</span>
          <span style={s.currencyBadge}>🥩 {currency}</span>
        </div>

        {/* Tab bar */}
        <div style={s.tabBar}>
          {TABS.map(t => (
            <button
              key={t.id}
              style={{ ...s.tabBtn, ...(tab === t.id ? s.tabActive : {}) }}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={s.content}>
          {tab === 'weapons'     && <WeaponsTab     currency={currency} buy={buy} eco={eco} />}
          {tab === 'armor'       && <ArmorTab        currency={currency} armor={armor} buy={buy} eco={eco} />}
          {tab === 'consumables' && <ConsumablesTab  currency={currency} playerHp={playerHp} maxHp={maxHp} revivePurchaseCount={revivePurchaseCount} buy={buy} eco={eco} />}
          {tab === 'upgrades'    && <UpgradesTab     currency={currency} weaponUpgrades={weaponUpgrades} explosiveUpgrades={explosiveUpgrades} buy={buy} eco={eco} />}
          {tab === 'map'         && <MapTab          currency={currency} buy={buy} eco={eco} />}
        </div>
      </div>
    </div>
  )
}

// ─── Weapons ──────────────────────────────────────────────────────────────────

function WeaponsTab({ currency, buy, eco }: { currency: number; buy: (fn: () => boolean | undefined) => void; eco: ReturnType<typeof getEconomy> }) {
  const { slotWeaponIds } = useGameStore()

  return (
    <div style={s.grid}>
      {NON_STARTER_WEAPONS.map(w => (
        <div key={w.id} style={s.card}>
          <div style={s.cardTitle}>{w.name.toUpperCase()}</div>
          <div style={s.cardStat}>DMG {w.damage} · RPM {w.rpm} · MAG {w.mag_size}</div>
          <div style={s.price}>🥩 {w.price}</div>
          <div style={s.btnRow}>
            {([0, 1] as const).map(slot => {
              const isEquipped = slotWeaponIds[slot] === w.id
              return (
                <button
                  key={slot}
                  style={{
                    ...s.buyBtn,
                    ...(isEquipped || currency < w.price ? s.disabledBtn : {}),
                  }}
                  disabled={isEquipped || currency < w.price}
                  onClick={() => buy(() => eco?.buyWeapon(slot, w.id))}
                >
                  {isEquipped ? `Slot ${slot + 1} ✓` : `→ Slot ${slot + 1}`}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Armor ────────────────────────────────────────────────────────────────────

function ArmorTab({ currency, armor, buy, eco }: {
  currency: number
  armor: ReturnType<typeof useGameStore>['armor']
  buy: (fn: () => boolean | undefined) => void
  eco: ReturnType<typeof getEconomy>
}) {
  const repairCost = armor ? Math.ceil(armor.price * shopData.armor_repair_cost_fraction) : 0
  const canRepair  = !!armor && armor.durability < armor.maxDurability && currency >= repairCost

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {armor && (
        <div style={{ ...s.card, borderColor: '#4488cc' }}>
          <div style={s.cardTitle}>EQUIPPED: {armor.id.toUpperCase()}</div>
          <div style={s.cardStat}>
            DR {Math.round(armor.damageReduction * 100)}% · SPD -{Math.round(armor.speedPenalty * 100)}%
          </div>
          <div style={{ ...s.miniBar, width: 200, background: '#222', borderRadius: 3, overflow: 'hidden', height: 8 }}>
            <div style={{ width: `${(armor.durability / armor.maxDurability) * 100}%`, height: '100%', background: '#4488cc' }} />
          </div>
          <div style={s.cardStat}>{Math.ceil(armor.durability)} / {armor.maxDurability} durability</div>
          <button
            style={{ ...s.buyBtn, ...(canRepair ? {} : s.disabledBtn) }}
            disabled={!canRepair}
            onClick={() => buy(() => eco?.repairArmor())}
          >
            Repair 🥩 {repairCost}
          </button>
        </div>
      )}

      <div style={s.grid}>
        {shopData.armor.map(a => {
          const owned = armor?.id === a.id
          const canBuy = !owned && currency >= a.price
          return (
            <div key={a.id} style={{ ...s.card, ...(owned ? { borderColor: '#4488cc' } : {}) }}>
              <div style={s.cardTitle}>{a.id.toUpperCase()} ARMOR</div>
              <div style={s.cardStat}>DR {Math.round(a.damage_reduction * 100)}%</div>
              <div style={s.cardStat}>DUR {a.durability} · SPD -{Math.round(a.speed_penalty * 100)}%</div>
              <div style={s.price}>🥩 {a.price}</div>
              <button
                style={{ ...s.buyBtn, ...(canBuy ? {} : s.disabledBtn) }}
                disabled={!canBuy}
                onClick={() => buy(() => eco?.buyArmor(a.id))}
              >
                {owned ? 'Equipped ✓' : 'Buy'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Consumables ──────────────────────────────────────────────────────────────

function ConsumablesTab({ currency, playerHp, maxHp, revivePurchaseCount, buy, eco }: {
  currency: number
  playerHp: number
  maxHp: number
  revivePurchaseCount: number
  buy: (fn: () => boolean | undefined) => void
  eco: ReturnType<typeof getEconomy>
}) {
  const { reviveTickets } = useGameStore()
  const orbDef    = shopData.consumables.sage_orb
  const revDef    = shopData.consumables.revive_ticket
  const revIdx    = Math.min(revivePurchaseCount, revDef.price_progression.length - 1)
  const revPrice  = revDef.price_progression[revIdx]
  const hpFull    = playerHp >= maxHp

  return (
    <div style={s.grid}>

      <div style={s.card}>
        <div style={s.cardTitle}>SAGE ORB</div>
        <div style={s.cardStat}>세이지의 구슬</div>
        <div style={s.cardStat}>Restore {orbDef.hp_amount} HP</div>
        <div style={{ ...s.cardStat, color: '#999' }}>{Math.ceil(playerHp)} / {maxHp} HP current</div>
        <div style={s.price}>🥩 {orbDef.price}</div>
        <button
          style={{ ...s.buyBtn, ...(hpFull || currency < orbDef.price ? s.disabledBtn : {}) }}
          disabled={hpFull || currency < orbDef.price}
          onClick={() => buy(() => eco?.buyConsumable('sage_orb'))}
        >
          {hpFull ? 'Full HP' : 'Use'}
        </button>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>REVIVE TICKET</div>
        <div style={s.cardStat}>부활권</div>
        <div style={s.cardStat}>Revive at 50 HP on death</div>
        <div style={s.cardStat}>Held: {reviveTickets}</div>
        <div style={s.price}>🥩 {revPrice}</div>
        <button
          style={{ ...s.buyBtn, ...(currency < revPrice ? s.disabledBtn : {}) }}
          disabled={currency < revPrice}
          onClick={() => buy(() => eco?.buyConsumable('revive_ticket'))}
        >
          Buy
        </button>
      </div>

    </div>
  )
}

// ─── Upgrades ─────────────────────────────────────────────────────────────────

function UpgradesTab({ currency, weaponUpgrades, explosiveUpgrades, buy, eco }: {
  currency: number
  weaponUpgrades: ReturnType<typeof useGameStore>['weaponUpgrades']
  explosiveUpgrades: ReturnType<typeof useGameStore>['explosiveUpgrades']
  buy: (fn: () => boolean | undefined) => void
  eco: ReturnType<typeof getEconomy>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Per-weapon upgrades */}
      {WEAPON_IDS_WITH_UPGRADES.map(wId => {
        const upgrades = weaponUpgrades[wId] ?? { damage: 0, recoil: 0, mag: 0, reload: 0 }
        const cfg = shopData.weapon_upgrades[wId as UpgWeaponId]
        return (
          <div key={wId} style={s.upgradeSection}>
            <div style={s.upgradeSectionTitle}>{wId.toUpperCase()}</div>
            {(Object.keys(UPGRADE_LABELS) as (keyof WeaponUpgrades)[]).map(type => {
              const level = upgrades[type]
              const maxed = level >= 3
              const price = maxed ? 0 : cfg.prices[level]
              const canBuy = !maxed && currency >= price
              return (
                <div key={type} style={s.upgradeRow}>
                  <span style={s.upgradeName}>{UPGRADE_LABELS[type]}</span>
                  <span style={s.upgradeLevel}>{'●'.repeat(level)}{'○'.repeat(3 - level)}</span>
                  <button
                    style={{ ...s.smallBuyBtn, ...(canBuy ? {} : s.disabledBtn) }}
                    disabled={!canBuy}
                    onClick={() => buy(() => eco?.buyWeaponUpgrade(wId, type))}
                  >
                    {maxed ? 'MAX' : `🥩 ${price}`}
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Explosive upgrades */}
      <div style={s.upgradeSection}>
        <div style={s.upgradeSectionTitle}>EXPLOSIVES</div>
        {shopData.explosive_upgrades.map(upg => {
          const storeKey = camelKey(upg.id) as keyof typeof explosiveUpgrades
          const owned    = explosiveUpgrades[storeKey]
          const canBuy   = !owned && currency >= upg.price
          return (
            <div key={upg.id} style={s.upgradeRow}>
              <span style={s.upgradeName}>{upg.target.toUpperCase()} {upg.effect}</span>
              <button
                style={{ ...s.smallBuyBtn, ...(canBuy ? {} : s.disabledBtn) }}
                disabled={!canBuy}
                onClick={() => buy(() => eco?.buyExplosiveUpgrade(storeKey))}
              >
                {owned ? '✓' : `🥩 ${upg.price}`}
              </button>
            </div>
          )
        })}
      </div>

    </div>
  )
}

// ─── Map Unlock ───────────────────────────────────────────────────────────────

function MapTab({ currency, buy, eco }: {
  currency: number
  buy: (fn: () => boolean | undefined) => void
  eco: ReturnType<typeof getEconomy>
}) {
  const { unlockedZones } = useGameStore()

  return (
    <div style={s.grid}>
      {shopData.map_unlocks.map(zone => {
        const unlocked = unlockedZones.includes(zone.id)
        const canBuy   = !unlocked && currency >= zone.cost
        return (
          <div key={zone.id} style={{ ...s.card, ...(unlocked ? { borderColor: '#44aa44' } : {}) }}>
            <div style={s.cardTitle}>{zone.id.toUpperCase()}</div>
            <div style={s.cardStat}>{zone.benefit}</div>
            <div style={s.price}>🥩 {zone.cost}</div>
            <button
              style={{ ...s.buyBtn, ...(canBuy ? {} : s.disabledBtn) }}
              disabled={!canBuy}
              onClick={() => buy(() => eco?.buyMapUnlock(zone.id))}
            >
              {unlocked ? 'Unlocked ✓' : 'Unlock'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Convert snake_case id to camelCase store key (e.g. grenade_damage → grenadeDamage)
function camelKey(s: string): string {
  return s.replace(/_([a-z])/g, (_match: string, c: string) => c.toUpperCase())
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.65)',
    zIndex: 5,
    pointerEvents: 'auto',
    fontFamily: 'monospace',
    color: '#fff',
  },
  panel: {
    width: 640, maxHeight: '85vh',
    background: '#111',
    border: '1px solid #444',
    borderRadius: 6,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid #333',
    background: '#1a0a00',
  },
  shopTitle:     { fontSize: 18, fontWeight: 'bold', color: '#ff6622', letterSpacing: 2 },
  timer:         { fontSize: 13, color: '#ffcc44', marginLeft: 'auto' },
  currencyBadge: { fontSize: 16, color: '#ffaa00', fontWeight: 'bold' },

  tabBar: { display: 'flex', borderBottom: '1px solid #333' },
  tabBtn: {
    flex: 1, padding: '8px 4px', fontSize: 12,
    background: 'transparent', color: '#aaa',
    border: 'none', borderBottom: '2px solid transparent',
    cursor: 'pointer', letterSpacing: 1,
    fontFamily: 'monospace',
  },
  tabActive: { color: '#ff6622', borderBottomColor: '#ff6622', background: 'rgba(255,80,0,0.08)' },

  content: { flex: 1, overflowY: 'auto', padding: 14 },

  grid: { display: 'flex', flexWrap: 'wrap', gap: 10 },
  card: {
    flex: '1 1 180px', padding: '10px 12px',
    background: '#1a1a1a', border: '1px solid #333',
    borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 4,
  },
  cardTitle: { fontSize: 13, fontWeight: 'bold', color: '#ff8855', letterSpacing: 1 },
  cardStat:  { fontSize: 11, color: '#aaa' },
  price:     { fontSize: 14, color: '#ffaa00', marginTop: 4 },
  btnRow:    { display: 'flex', gap: 6, marginTop: 6 },
  buyBtn: {
    flex: 1, padding: '6px 8px', fontSize: 12,
    background: '#442200', color: '#ffcc88',
    border: '1px solid #884400', borderRadius: 3,
    cursor: 'pointer', fontFamily: 'monospace',
  },
  disabledBtn: {
    background: '#222', color: '#555',
    border: '1px solid #333', cursor: 'not-allowed',
  },

  upgradeSection: {
    background: '#1a1a1a', border: '1px solid #333',
    borderRadius: 4, padding: '8px 12px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  upgradeSectionTitle: { fontSize: 12, color: '#ff8855', fontWeight: 'bold', marginBottom: 2 },
  upgradeRow: { display: 'flex', alignItems: 'center', gap: 8 },
  upgradeName: { flex: 1, fontSize: 12, color: '#ccc' },
  upgradeLevel: { fontSize: 13, color: '#ffaa00', letterSpacing: 2, width: 32 },
  smallBuyBtn: {
    padding: '3px 8px', fontSize: 11,
    background: '#442200', color: '#ffcc88',
    border: '1px solid #884400', borderRadius: 3,
    cursor: 'pointer', fontFamily: 'monospace', minWidth: 52,
  },

  miniBar: {},
}
