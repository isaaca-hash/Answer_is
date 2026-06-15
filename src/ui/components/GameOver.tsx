import { useState, useEffect } from 'react'
import { useGameStore } from '../store'
import { getBestWave } from '../../utils/storage'

interface Props {
  onRestart: () => void
}

export function GameOver({ onRestart }: Props) {
  const { phase, wave, kills, headshots } = useGameStore()
  const [bestWave, setBestWave] = useState(0)

  useEffect(() => {
    if (phase === 'game_over') setBestWave(getBestWave())
  }, [phase])

  if (phase !== 'game_over') return null

  const hsRatio = kills > 0 ? Math.round((headshots / kills) * 100) : 0

  return (
    <div style={styles.overlay}>
      <h1 style={styles.title}>YOU DIED</h1>
      <div style={styles.stats}>
        <p>Wave reached: <strong>{wave}</strong></p>
        <p>Kills: <strong>{kills}</strong></p>
        <p>Headshot ratio: <strong>{hsRatio}%</strong></p>
        {bestWave > 0 && (
          <p style={{ color: wave >= bestWave ? '#ffdd44' : '#888' }}>
            Best wave: <strong>{bestWave}</strong>
            {wave >= bestWave && ' 🏆 NEW RECORD'}
          </p>
        )}
      </div>
      <button style={styles.btn} onClick={onRestart}>↺  RESTART</button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.88)',
    color: '#fff',
    fontFamily: 'monospace',
    gap: 12,
    zIndex: 10,
  },
  title: { fontSize: 52, color: '#cc0000', textShadow: '0 0 30px #cc0000', margin: 0 },
  stats: { fontSize: 16, opacity: 0.8, textAlign: 'center', lineHeight: 2 },
  btn: {
    marginTop: 16,
    padding: '12px 40px',
    fontSize: 18,
    fontFamily: 'monospace',
    background: '#441100',
    color: '#fff',
    border: '1px solid #cc2200',
    borderRadius: 4,
    cursor: 'pointer',
    letterSpacing: 2,
    pointerEvents: 'all',
  },
}
