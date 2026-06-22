import { useGameStore } from '../store'
import { saveSensitivity, saveVolume } from '../../utils/storage'
import { AudioManager } from '../../core/AudioManager'

interface Props {
  onRestart: () => void
}

export function PauseMenu({ onRestart }: Props) {
  const { phase, setPhase, sensitivity, setSensitivity, volume, setVolume } = useGameStore()
  if (phase !== 'paused') return null

  function handleSensitivity(v: number) {
    setSensitivity(v)
    saveSensitivity(v)
  }

  function handleVolume(v: number) {
    setVolume(v)
    saveVolume(v)
    AudioManager.getInstance().setVolume(v)
  }

  return (
    <div style={s.overlay}>
      <h2 style={s.title}>PAUSED</h2>
      <button style={s.btn} onClick={() => setPhase('playing')}>▶  RESUME</button>
      <button style={{ ...s.btn, ...s.dangerBtn }} onClick={onRestart}>↺  RESTART</button>

      <div style={s.optionsBox}>
        <label style={s.label}>
          Sensitivity: <span style={s.val}>{sensitivity.toFixed(4)}</span>
          <input type="range" min={0.0005} max={0.008} step={0.0001}
            value={sensitivity} onChange={e => handleSensitivity(parseFloat(e.target.value))}
            style={s.slider} />
        </label>
        <label style={s.label}>
          Volume: <span style={s.val}>{Math.round(volume * 100)}%</span>
          <input type="range" min={0} max={1} step={0.01}
            value={volume} onChange={e => handleVolume(parseFloat(e.target.value))}
            style={s.slider} />
        </label>
      </div>

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
  optionsBox: {
    display: 'flex', flexDirection: 'column', gap: 10,
    background: 'rgba(255,255,255,0.05)', border: '1px solid #443300',
    borderRadius: 6, padding: '14px 20px', marginTop: 4, width: 280,
  },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#ccaa66' },
  val: { color: '#fff', fontWeight: 'bold' },
  slider: { width: '100%', accentColor: '#cc4400', cursor: 'pointer' },
  hint: { fontSize: 11, opacity: 0.4, marginTop: 8 },
}
