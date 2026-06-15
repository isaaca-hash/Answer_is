import { HUD }           from './components/HUD'
import { ShopUI }        from './components/ShopUI'
import { PauseMenu }     from './components/PauseMenu'
import { StatsOverlay }  from './components/StatsOverlay'
import { MainMenu }      from './components/MainMenu'
import { GameOver }      from './components/GameOver'

interface Props {
  onStart:   () => void
  onRestart: () => void
}

export function GameUIRoot({ onStart, onRestart }: Props) {
  return (
    <>
      <MainMenu  onStart={onStart} />
      <HUD />
      <ShopUI />
      <PauseMenu onRestart={onRestart} />
      <StatsOverlay />
      <GameOver  onRestart={onRestart} />
    </>
  )
}
