import { useState, useEffect } from 'react'
import { useGameStore } from '../store'

export function HUD() {
  const {
    playerHp, maxHp, armor,
    currentAmmo, reserveAmmo, isReloading,
    wave, zombiesRemaining, restTimer,
    currency, phase,
    kills, headshots,
    activeSlot, isSwitching, slotWeaponNames,
    isScoped,
    grenadeCount, molotovCount,
    recoilSignal, lastHitTime,
  } = useGameStore()

  // Crosshair spread — expands briefly on each shot
  const [crosshairGap, setCrosshairGap] = useState(4)
  useEffect(() => {
    if (recoilSignal === 0) return
    setCrosshairGap(g => Math.min(g + 6, 18))
    const id = setTimeout(() => setCrosshairGap(4), 180)
    return () => clearTimeout(id)
  }, [recoilSignal])

  // Hit edge flash — flares on damage
  const [hitFlash, setHitFlash] = useState(0)
  useEffect(() => {
    if (lastHitTime === 0) return
    setHitFlash(1)
    const id = setTimeout(() => setHitFlash(0), 380)
    return () => clearTimeout(id)
  }, [lastHitTime])

  if (phase === 'menu' || phase === 'game_over') return null

  const hpPct = (playerHp / maxHp) * 100
  const lowHp = playerHp <= 20

  // Sniper scope
  if (isScoped) {
    return (
      <div style={s.overlay}>
        <div style={s.scopeOverlay}>
          <div style={s.scopeCircle} />
          <div style={s.scopeH} />
          <div style={s.scopeV} />
          <div style={s.scopeTopBlack} />
          <div style={s.scopeBottomBlack} />
          <div style={s.scopeLeftBlack} />
          <div style={s.scopeRightBlack} />
        </div>
        <div style={{ ...s.bottomRight, bottom: 40 }}>
          <span style={{ ...s.ammoMag, fontSize: 22 }}>{currentAmmo}</span>
          <span style={s.ammoSlash}> / </span>
          <span style={{ ...s.ammoReserve, fontSize: 16 }}>{reserveAmmo}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={s.overlay}>

      {/* 4-arm spreading crosshair */}
      <div style={s.crosshairWrap}>
        <div style={{ ...s.armTop,    bottom: crosshairGap }} />
        <div style={{ ...s.armBottom, top:    crosshairGap }} />
        <div style={{ ...s.armLeft,   right:  crosshairGap }} />
        <div style={{ ...s.armRight,  left:   crosshairGap }} />
      </div>

      {/* Top-center: wave info */}
      <div style={s.topCenter}>
        <span style={s.waveLabel}>WAVE {wave}</span>
        {phase === 'wave_rest'
          ? <span style={s.restTimer}>Shop — next wave in {Math.ceil(restTimer)}s</span>
          : <span style={s.zombieCount}>{zombiesRemaining} remaining</span>}
      </div>

      {/* Top-right: currency */}
      <div style={s.topRight}>
        <span style={s.currency}>🥩 {currency}</span>
      </div>

      {/* Top-left: live stats */}
      <div style={s.topLeft}>
        K: {kills}&nbsp;&nbsp;HS: {headshots}
      </div>

      {/* Bottom-left: HP + Armor */}
      <div style={s.bottomLeft}>
        <div style={{ ...s.hpBarOuter, ...(lowHp ? s.lowHpGlow : {}) }}>
          <div style={{
            ...s.hpBarFill,
            width: `${hpPct}%`,
            background: lowHp ? '#ff2222' : '#cc0000',
          }} />
        </div>
        <span style={s.hpText}>{Math.ceil(playerHp)} / {maxHp} HP</span>
        {armor && (
          <>
            <div style={s.armorBarOuter}>
              <div style={{
                ...s.armorBarFill,
                width: `${(armor.durability / armor.maxDurability) * 100}%`,
              }} />
            </div>
            <span style={s.armorText}>{Math.ceil(armor.durability)} ARMOR</span>
          </>
        )}
      </div>

      {/* Bottom-right: weapon slots + ammo + explosives */}
      <div style={s.bottomRight}>
        <div style={s.explosiveRow}>
          <span style={{ ...s.explosiveItem, opacity: grenadeCount > 0 ? 1 : 0.3 }}>
            💣 {grenadeCount}
          </span>
          <span style={{ ...s.explosiveItem, opacity: molotovCount > 0 ? 1 : 0.3 }}>
            🔥 {molotovCount}
          </span>
        </div>
        <div style={s.slotRow}>
          {([0, 1] as const).map(slot => (
            <div key={slot} style={{
              ...s.slotBox,
              ...(activeSlot === slot ? s.slotActive : s.slotInactive),
            }}>
              <span style={s.slotNum}>{slot + 1}</span>
              <span style={s.slotName}>{slotWeaponNames[slot]}</span>
            </div>
          ))}
        </div>
        {isSwitching ? (
          <span style={s.switchText}>SWITCHING...</span>
        ) : isReloading ? (
          <span style={s.reloadText}>RELOADING...</span>
        ) : (
          <span style={s.ammoText}>
            <span style={s.ammoMag}>{currentAmmo}</span>
            <span style={s.ammoSlash}> / </span>
            <span style={s.ammoReserve}>{reserveAmmo}</span>
          </span>
        )}
      </div>

      {/* Edge damage flash — key forces re-animation on each distinct hit */}
      {hitFlash > 0 && (
        <div
          key={lastHitTime}
          style={{
            ...s.hitFlash,
            boxShadow: `inset 0 0 80px rgba(255,0,0,${hitFlash * 0.75})`,
          }}
        />
      )}

      {/* Low HP vignette */}
      {lowHp && <div style={s.vignette} />}

      {/* Low HP vein overlay */}
      {lowHp && <div style={s.veinOverlay} />}

      {/* Pause hint */}
      {phase === 'playing' && (
        <div style={s.pauseHint}>ESC pause</div>
      )}
    </div>
  )
}

const ARM_W = 2
const ARM_H = 8
const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    pointerEvents: 'none',
    fontFamily: 'monospace', color: '#fff',
    userSelect: 'none',
  },

  // 4-arm crosshair
  crosshairWrap: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)',
    width: 0, height: 0,
  },
  armTop:    { position: 'absolute', left: -ARM_W/2, width: ARM_W, height: ARM_H, background: 'rgba(100,180,255,0.9)', transform: 'translateY(-100%)' },
  armBottom: { position: 'absolute', left: -ARM_W/2, width: ARM_W, height: ARM_H, background: 'rgba(100,180,255,0.9)' },
  armLeft:   { position: 'absolute', top:  -ARM_W/2, width: ARM_H, height: ARM_W, background: 'rgba(100,180,255,0.9)', transform: 'translateX(-100%)' },
  armRight:  { position: 'absolute', top:  -ARM_W/2, width: ARM_H, height: ARM_W, background: 'rgba(100,180,255,0.9)' },

  // Scope
  scopeOverlay: {
    position: 'absolute', inset: 0,
    background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  scopeCircle: {
    position: 'absolute', width: 420, height: 420,
    borderRadius: '50%', border: '2px solid rgba(100,180,100,0.8)',
    boxShadow: '0 0 0 9999px #000',
  },
  scopeH: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 380, height: 1, background: 'rgba(100,200,100,0.7)' },
  scopeV: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 1, height: 380, background: 'rgba(100,200,100,0.7)' },
  scopeTopBlack:    { position: 'absolute', top: 0,    left: 0, right: 0, height: 'calc(50% - 210px)', background: '#000' },
  scopeBottomBlack: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 'calc(50% - 210px)', background: '#000' },
  scopeLeftBlack:   { position: 'absolute', left: 0,   top: 0, bottom: 0, width: 'calc(50% - 210px)',  background: '#000' },
  scopeRightBlack:  { position: 'absolute', right: 0,  top: 0, bottom: 0, width: 'calc(50% - 210px)',  background: '#000' },

  // Wave info
  topCenter: {
    position: 'absolute', top: 20, left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  },
  waveLabel:   { fontSize: 22, fontWeight: 'bold', textShadow: '0 0 8px #ff4400', letterSpacing: 3 },
  zombieCount: { fontSize: 14, opacity: 0.85 },
  restTimer:   { fontSize: 14, color: '#ffcc00' },

  topRight: { position: 'absolute', top: 20, right: 24, fontSize: 18, fontWeight: 'bold' },
  currency: { textShadow: '0 0 6px #ff8800' },
  topLeft:  { position: 'absolute', top: 20, left: 20, fontSize: 12, opacity: 0.6 },

  bottomLeft: {
    position: 'absolute', bottom: 30, left: 24,
    display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180,
  },
  hpBarOuter: { width: 180, height: 14, background: '#333', borderRadius: 3, overflow: 'hidden', border: '1px solid #555' },
  hpBarFill:  { height: '100%', transition: 'width 0.1s' },
  hpText:     { fontSize: 13, opacity: 0.9 },
  lowHpGlow:  { boxShadow: '0 0 10px #ff0000' },
  armorBarOuter: { width: 180, height: 10, background: '#222', borderRadius: 3, overflow: 'hidden', border: '1px solid #336' },
  armorBarFill:  { height: '100%', background: '#4488cc', transition: 'width 0.1s' },
  armorText:     { fontSize: 11, opacity: 0.7, color: '#88bbff' },

  bottomRight: {
    position: 'absolute', bottom: 24, right: 24,
    display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6,
  },
  explosiveRow: { display: 'flex', gap: 12, marginBottom: 2 },
  explosiveItem: { fontSize: 15 },
  slotRow: { display: 'flex', gap: 6 },
  slotBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 10px', borderRadius: 3, minWidth: 70, border: '1px solid' },
  slotActive:   { background: 'rgba(200,60,0,0.45)', borderColor: '#ff5500' },
  slotInactive: { background: 'rgba(0,0,0,0.35)',    borderColor: '#555', opacity: 0.6 },
  slotNum:  { fontSize: 10, opacity: 0.6 },
  slotName: { fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  ammoText:    { fontSize: 28, fontWeight: 'bold' },
  ammoMag:     { fontSize: 32 },
  ammoSlash:   { fontSize: 20, opacity: 0.5 },
  ammoReserve: { fontSize: 20, opacity: 0.7 },
  reloadText:  { fontSize: 18, color: '#ffcc00', fontWeight: 'bold' },
  switchText:  { fontSize: 18, color: '#aaaaff', fontWeight: 'bold' },

  hitFlash: {
    position: 'absolute', inset: 0,
    pointerEvents: 'none',
    transition: 'box-shadow 0.35s ease-out',
  },

  vignette: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 50%, rgba(180,0,0,0.55) 100%)',
  },
  veinOverlay: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse at center, transparent 40%, rgba(120,0,0,0.30) 70%, rgba(200,0,0,0.50) 100%)',
    backgroundBlendMode: 'multiply',
  },

  pauseHint: { position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 10, opacity: 0.25 },
}
