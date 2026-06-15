import * as THREE from 'three'

// Returns a bright placeholder box so the build always runs without real assets.
export function makePlaceholderMesh(
  width = 1, height = 1, depth = 1,
  color = 0xff00ff
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, height, depth)
  const mat = new THREE.MeshStandardMaterial({ color })
  return new THREE.Mesh(geo, mat)
}

export function makePlaceholderSphere(radius = 0.5, color = 0xff00ff): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 8, 8)
  const mat = new THREE.MeshStandardMaterial({ color })
  return new THREE.Mesh(geo, mat)
}
