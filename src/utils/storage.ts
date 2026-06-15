const K = {
  BEST_WAVE:   'ryu_best_wave',
  SENSITIVITY: 'ryu_sensitivity',
  VOLUME:      'ryu_volume',
} as const

export function getBestWave(): number {
  return parseInt(localStorage.getItem(K.BEST_WAVE) ?? '0', 10)
}

export function saveBestWave(wave: number): void {
  if (wave > getBestWave()) localStorage.setItem(K.BEST_WAVE, String(wave))
}

export function getSensitivity(): number {
  return parseFloat(localStorage.getItem(K.SENSITIVITY) ?? '0.002')
}

export function saveSensitivity(v: number): void {
  localStorage.setItem(K.SENSITIVITY, String(v))
}

export function getVolume(): number {
  return parseFloat(localStorage.getItem(K.VOLUME) ?? '1.0')
}

export function saveVolume(v: number): void {
  localStorage.setItem(K.VOLUME, String(v))
}
