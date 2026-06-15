import { useGameStore } from '../store'

export function StatsOverlay() {
  const { phase, wave, kills, headshots, currency, zombiesRemaining, showStats } = useGameStore()

  if (!showStats) return null
  if (phase === 'menu' || phase === 'game_over') return null

  const hsRatio = kills > 0 ? Math.round((headshots / kills) * 100) : 0

  return (
    <div style={s.overlay}>
      <div style={s.panel}>
        <div style={s.title}>STATS</div>
        <Row label="Wave"         value={wave} />
        <Row label="Zombies left" value={zombiesRemaining} />
        <Row label="Kills"        value={kills} />
        <Row label="Headshots"    value={`${headshots} (${hsRatio}%)`} />
        <Row label="Currency"     value={`🥩 ${currency}`} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32 }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', zIndex: 6,
  },
  panel: {
    background: 'rgba(0,0,0,0.80)',
    border: '1px solid #444', borderRadius: 6,
    padding: '20px 32px',
    fontFamily: 'monospace', color: '#fff', fontSize: 15,
    display: 'flex', flexDirection: 'column', gap: 10,
    minWidth: 280,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#ffcc44', marginBottom: 6, letterSpacing: 3 },
}
