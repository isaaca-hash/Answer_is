import { useGameStore } from '../store'

interface Props {
  onRestart: () => void
}

export function PauseMenu({ onRestart }: Props) {
  const { phase, setPhase } = useGameStore()
  if (phase !== 'paused') return null

  return (
    <div style={s.overlay}>
      <h2 style={s.title}>PAUSED</h2>
      <button style={s.btn} onClick={() => setPhase('playing')}>▶  RESUME</button>
      <button style={{ ...s.btn, ...s.dangerBtn }} onClick={onRestart}>↺  RESTART</button>
      <p style={s.hint}>Press ESC to resume</p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.72)',
    color: '#fff', fontFamily: 'monospace',
    gap: 14, zIndex: 8,
    pointerEvents: 'auto',
  },
  title: { fontSize: 36, color: '#ffcc44', margin: 0, letterSpacing: 4 },
  btn: {
    width: 200, padding: '11px 0', fontSize: 16,
    fontFamily: 'monospace', background: '#332200',
    color: '#ffcc88', border: '1px solid #885500',
    borderRadius: 4, cursor: 'pointer', letterSpacing: 2,
    pointerEvents: 'all',
  },
  dangerBtn: { background: '#330011', borderColor: '#880033', color: '#ff8899' },
  hint: { fontSize: 11, opacity: 0.4, marginTop: 8 },
}
