import { Howl, Howler } from 'howler'
import { getVolume } from '../utils/storage'

// All SFX paths relative to /public. Files are optional — missing files fail silently.
const SFX: Record<string, string[]> = {
  pistol_fire:    ['/audio/sfx/pistol_fire.mp3',    '/audio/sfx/pistol_fire.ogg'],
  rifle_fire:     ['/audio/sfx/rifle_fire.mp3',     '/audio/sfx/rifle_fire.ogg'],
  shotgun_fire:   ['/audio/sfx/shotgun_fire.mp3',   '/audio/sfx/shotgun_fire.ogg'],
  sniper_fire:    ['/audio/sfx/sniper_fire.mp3',    '/audio/sfx/sniper_fire.ogg'],
  pistol_reload:  ['/audio/sfx/pistol_reload.mp3'],
  rifle_reload:   ['/audio/sfx/rifle_reload.mp3'],
  shotgun_reload: ['/audio/sfx/shotgun_reload.mp3'],
  sniper_reload:  ['/audio/sfx/sniper_reload.mp3'],
  zombie_hit:     ['/audio/sfx/zombie_hit.mp3'],
  zombie_die:     ['/audio/sfx/zombie_die.mp3'],
  player_hit:     ['/audio/sfx/player_hit.mp3'],
  explosion:      ['/audio/sfx/explosion.mp3'],
  molotov_land:   ['/audio/sfx/molotov_land.mp3'],
  grenade_throw:  ['/audio/sfx/grenade_throw.mp3'],
  molotov_throw:  ['/audio/sfx/molotov_throw.mp3'],
  buy_success:    ['/audio/sfx/buy_success.mp3'],
  buy_fail:       ['/audio/sfx/buy_fail.mp3'],
  upgrade:        ['/audio/sfx/upgrade.mp3'],
}

export class AudioManager {
  private static _inst: AudioManager | null = null
  static getInstance(): AudioManager {
    if (!AudioManager._inst) AudioManager._inst = new AudioManager()
    return AudioManager._inst
  }

  private cache  = new Map<string, Howl>()
  private bgm:   Howl | null = null
  private muted  = false

  private constructor() {
    Howler.volume(getVolume())
  }

  // Play a one-shot sound. Silently skipped if no file is present.
  play(id: string, vol = 1.0): void {
    if (this.muted) return
    try {
      let howl = this.cache.get(id)
      if (!howl) {
        const src = SFX[id]
        if (!src) return
        howl = new Howl({
          src,
          preload: true,
          html5: false,
          onloaderror: (_id: number, err: unknown) => {
            console.debug(`[Audio] missing ${id}:`, err)
          },
        })
        this.cache.set(id, howl)
      }
      howl.volume(vol)
      howl.play()
    } catch { /* never let audio crash the game */ }
  }

  playBGM(): void {
    if (this.bgm) return
    try {
      this.bgm = new Howl({
        src: ['/audio/bgm.ogg', '/audio/bgm.mp3'],
        loop:   true,
        volume: 0.35,
        onloaderror: () => { this.bgm = null },
      })
      this.bgm.play()
    } catch {}
  }

  stopBGM(): void {
    this.bgm?.stop()
    this.bgm = null
  }

  setVolume(vol: number): void  { Howler.volume(vol) }
  mute(on: boolean): void       { this.muted = on; Howler.mute(on) }
  get isMuted(): boolean        { return this.muted }
}
