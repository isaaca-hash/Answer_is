import * as THREE from 'three'

const ARENA_SIZE = 40   // half-extent: 40x40 arena
const WALL_H     = 5
const WALL_T     = 1    // thickness

// Simple box arena: flat ground + 4 perimeter walls.
// All walls registered as Box3 colliders for Movement to resolve against.
export class BoxMap {
  private colliders: THREE.Box3[] = []

  constructor(scene: THREE.Scene) {
    this.buildFloor(scene)
    this.buildWalls(scene)
    this.addCover(scene)
  }

  getColliders(): THREE.Box3[] { return this.colliders }

  private buildFloor(scene: THREE.Scene): void {
    const geo = new THREE.PlaneGeometry(ARENA_SIZE * 2, ARENA_SIZE * 2)
    const mat = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.9, metalness: 0 })
    const floor = new THREE.Mesh(geo, mat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
  }

  private buildWalls(scene: THREE.Scene): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x5c3d1e, roughness: 0.8 })
    const defs: [number, number, number, number, number, number][] = [
      // x, y, z, width, height, depth
      [0,           WALL_H / 2,  ARENA_SIZE,  ARENA_SIZE * 2, WALL_H, WALL_T],  // north
      [0,           WALL_H / 2, -ARENA_SIZE,  ARENA_SIZE * 2, WALL_H, WALL_T],  // south
      [ ARENA_SIZE, WALL_H / 2,  0,           WALL_T,         WALL_H, ARENA_SIZE * 2],  // east
      [-ARENA_SIZE, WALL_H / 2,  0,           WALL_T,         WALL_H, ARENA_SIZE * 2],  // west
    ]
    for (const [x, y, z, w, h, d] of defs) {
      const geo  = new THREE.BoxGeometry(w, h, d)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      // Register as AABB collider
      const box = new THREE.Box3().setFromObject(mesh)
      this.colliders.push(box)
    }
  }

  // A handful of box crates for cover — placeholder geometry
  private addCover(scene: THREE.Scene): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.7 })
    const positions: [number, number, number, number, number, number][] = [
      [ 5,  0.5,  5,  1.5, 1, 1.5],
      [-5,  0.5,  8,  1.5, 1, 1.5],
      [ 8,  0.5, -6,  1.5, 1, 1.5],
      [-8,  0.5, -5,  1.5, 1, 1.5],
      [ 0,  0.5, 12,  2,   1, 1],
      [12,  0.5,  0,  1,   1, 2],
      [-12, 0.5,  0,  1,   1, 2],
    ]
    for (const [x, y, z, w, h, d] of positions) {
      const geo  = new THREE.BoxGeometry(w, h, d)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      scene.add(mesh)
      this.colliders.push(new THREE.Box3().setFromObject(mesh))
    }
  }
}
