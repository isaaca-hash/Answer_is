import { useState, useEffect } from 'react'
import { useGameStore } from '../store'
import { getBestWave } from '../../utils/storage'

interface Props {
  onStart: () => void
}

export function MainMenu({ onStart }: Props) {
  const phase = useGameStore(s => s.phase)
  const [bestWave, setBestWave] = useState(0)

  useEffect(() => { setBestWave(getBestWave()) }, [])

  if (phase !== 'menu') return null

  return (
    <div style={styles.overlay}>
      <h1 style={styles.title}>류승룡 기모찌</h1>
      <p style={styles.subtitle}>Ryu Seung-ryong Kimochi</p>
      <p style={styles.hint}>Zombie FPS · Infinite Wave Survival</p>
      {bestWave > 0 && (
        <p style={styles.bestWave}>Best wave: {bestWave}</p>
      )}
      <button style={styles.btn} onClick={onStart}>▶  START</button>
      <p style={styles.controls}>
        WASD move · Mouse look · LMB fire · R reload · Shift dash · Space jump
        <br />G grenade · F molotov · 1/2 swap weapon
      </p>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.82)',
    color: '#fff',
    fontFamily: 'monospace',
    gap: 16,
    zIndex: 10,
  },
  title:    { fontSize: 42, color: '#ff4400', textShadow: '0 0 20px #ff4400', margin: 0 },
  subtitle: { fontSize: 18, opacity: 0.7, margin: 0 },
  hint:     { fontSize: 13, opacity: 0.5, margin: 0 },
  bestWave: { fontSize: 14, color: '#ffdd44', margin: 0 },
  btn: {
    marginTop: 20,
    padding: '14px 48px',
    fontSize: 20,
    fontFamily: 'monospace',
    background: '#cc2200',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    letterSpacing: 2,
    pointerEvents: 'all',
  },
  controls: { fontSize: 11, opacity: 0.4, marginTop: 12, textAlign: 'center', maxWidth: 400 },
}
