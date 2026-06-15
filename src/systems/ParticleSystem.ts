import * as THREE from 'three'

interface Particle {
  mesh:     THREE.Mesh
  velocity: THREE.Vector3
  life:     number
  maxLife:  number
}

// Simple pooled particle system.
// All particles are tiny sphere meshes with transparent MeshBasicMaterial.
// Gravity applied each frame; fades out as lifetime expires.
export class ParticleSystem {
  private scene:     THREE.Scene
  private active:    Particle[] = []
  private geoSmall  = new THREE.SphereGeometry(0.03, 3, 3)
  private geoMedium = new THREE.SphereGeometry(0.06, 3, 3)
  private geoLarge  = new THREE.SphereGeometry(0.10, 3, 3)

  constructor(scene: THREE.Scene) { this.scene = scene }

  // Bullet impact — yellow/orange sparks
  spawnHitSpark(pos: THREE.Vector3, count = 6): void {
    for (let i = 0; i < count; i++) {
      const color = Math.random() > 0.4 ? 0xffaa00 : 0xff6600
      this.emit(pos, this.geoSmall, color, 0.22, 5)
    }
  }

  // Zombie hit — red blood
  spawnBlood(pos: THREE.Vector3, count = 8): void {
    for (let i = 0; i < count; i++) {
      const color = Math.random() > 0.3 ? 0xaa0000 : 0xcc3300
      this.emit(pos, this.geoMedium, color, 0.35, 3.5)
    }
  }

  // Zombie death — brown/sand dust cloud
  spawnDeathDust(pos: THREE.Vector3, count = 14): void {
    for (let i = 0; i < count; i++) {
      const color = [0x554433, 0x886644, 0x443322][Math.floor(Math.random() * 3)]
      const geo   = Math.random() > 0.5 ? this.geoMedium : this.geoLarge
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.8,
        Math.random() * 0.4,
        (Math.random() - 0.5) * 0.8,
      )
      this.emit(pos.clone().add(offset), geo, color, 0.55, 2.5)
    }
  }

  // Explosion shockwave burst — large bright particles
  spawnExplosionBurst(pos: THREE.Vector3, count = 20): void {
    for (let i = 0; i < count; i++) {
      const color = [0xff6600, 0xffaa00, 0xff2200][Math.floor(Math.random() * 3)]
      this.emit(pos, this.geoMedium, color, 0.5, 8)
    }
  }

  update(dt: number): void {
    let i = this.active.length
    while (i--) {
      const p = this.active[i]
      p.velocity.y -= 12 * dt
      p.mesh.position.addScaledVector(p.velocity, dt)
      p.life -= dt

      const alpha = Math.max(0, p.life / p.maxLife)
      ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = alpha

      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        ;(p.mesh.material as THREE.MeshBasicMaterial).dispose()
        this.active.splice(i, 1)
      }
    }
  }

  dispose(): void {
    for (const p of this.active) this.scene.remove(p.mesh)
    this.active = []
    this.geoSmall.dispose()
    this.geoMedium.dispose()
    this.geoLarge.dispose()
  }

  private emit(
    pos: THREE.Vector3,
    geo: THREE.BufferGeometry,
    color: number,
    life: number,
    speed: number,
  ): void {
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    this.scene.add(mesh)

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * speed * 2,
      Math.random() * speed,
      (Math.random() - 0.5) * speed * 2,
    )
    this.active.push({ mesh, velocity: vel, life, maxLife: life })
  }
}
