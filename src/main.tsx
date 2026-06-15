import { StrictMode, useRef, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { GameUIRoot } from './ui/GameUIRoot'
import { Game } from './core/Game'
import { useGameStore } from './ui/store'
import { saveBestWave } from './utils/storage'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef   = useRef<Game | null>(null)

  // Save best wave to localStorage whenever the game ends.
  useEffect(() => {
    return useGameStore.subscribe((state, prev) => {
      if (state.phase === 'game_over' && prev.phase !== 'game_over') {
        saveBestWave(state.wave)
      }
    })
  }, [])

  const startGame = useCallback(() => {
    if (!canvasRef.current) return
    gameRef.current?.dispose()

    // Reset all store state for a fresh run
    const store = useGameStore.getState()
    store.setPlayerHp(100)
    store.setWave(0)
    store.setZombiesRemaining(0)
    store.setCurrency(0)
    store.setPhase('playing')
    store.setScoped(false)
    store.setGrenadeCount(3)
    store.setMolotovCount(2)
    store.setActiveSlot(0)
    store.setIsSwitching(false)
    store.setArmor(null)
    store.setStunTimer(0)
    store.setLastHitTime(0)
    store.setShowStats(false)
    useGameStore.setState({
      kills: 0, headshots: 0, restTimer: 0,
      slotWeaponNames:  ['PISTOL', 'RIFLE'],
      slotWeaponIds:    ['pistol', 'rifle'],
      reviveTickets:    0,
      revivePurchaseCount: 0,
      unlockedZones:    [],
      weaponUpgrades: {
        pistol:  { damage: 0, recoil: 0, mag: 0, reload: 0 },
        rifle:   { damage: 0, recoil: 0, mag: 0, reload: 0 },
        shotgun: { damage: 0, recoil: 0, mag: 0, reload: 0 },
        sniper:  { damage: 0, recoil: 0, mag: 0, reload: 0 },
      },
      explosiveUpgrades: {
        grenadeDamage: false, grenadeRadius: false,
        molotovDuration: false, molotovArea: false,
      },
    })

    const game = new Game(canvasRef.current)
    gameRef.current = game
    game.start()
  }, [])

  const restartGame = useCallback(() => { startGame() }, [startGame])

  useEffect(() => {
    return () => { gameRef.current?.dispose() }
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
      <GameUIRoot onStart={startGame} onRestart={restartGame} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
