Asset integration notes — CC0 placeholders + GLB instructions

- **Placeholders added (procedural, CC0-safe)**:
  - `src/assets/proceduralTextures.js`: runtime-generated car paint and asphalt textures.
  - `src/Vehicle.jsx`: now uses the procedural car-paint as a `meshPhysicalMaterial` map.
  - `src/Track.jsx`: now uses the procedural asphalt texture as the road `map` + `bumpMap`.

- **How to replace placeholders with real CC0 PBR textures**:
  1. Download desired PBR maps from AmbientCG (https://ambientcg.com/) for car paint and Poly Haven (https://polyhaven.com/) for asphalt. Both offer CC0 assets — verify license on each asset page.
  2. Place files in `public/assets/textures/car/` and `public/assets/textures/track/` using concise names (e.g. `car_basecolor.jpg`, `car_normal.jpg`, `track_albedo.jpg`, `track_normal.jpg`).
  3. In `src/Vehicle.jsx` replace the `createCarPaintTexture(...)` call with a `useLoader(THREE.TextureLoader, [...])` preload and assign `map`, `normalMap`, `roughnessMap`, `metalnessMap` to the `meshPhysicalMaterial`.
  4. In `src/Track.jsx` replace `asphaltTex` with the loaded textures and assign `map`/`normalMap`/`roughnessMap`/`bumpMap` as needed.
  5. Keep texture sizes <= 2048px for performance; 1024px is typically sufficient for placeholders.

- **GLB (BMW G87 M2) purchase & integration guidance**:
  - Recommended marketplaces: Sketchfab (https://sketchfab.com), CGTrader (https://www.cgtrader.com), TurboSquid/Quixel/Poliigon. Filter by "downloadable" and check license (royalty-free, commercial use, or CC0 depending on your needs).
  - Before buying, confirm: file format (GLB/GLTF), included texture maps (albedo/normal/roughness/metalness), whether wheels/doors are separate meshes, and triangle count.
  - Target web-friendly budget: chassis ~4–15k tris, wheels + misc ~5–10k; aim total <50k tris for smoother real-time performance.
  - Integration steps (after purchase):
    1. Put the downloaded `.glb` in `public/assets/models/G87/model.glb`.
    2. Install `@react-three/drei` and use `useGLTF('/assets/models/G87/model.glb')` in a new `src/CarModel.jsx` to load the model.
    3. Replace the placeholder box in `Vehicle.jsx` with `<CarModel />`. If wheels are separate, locate wheel meshes and attach them to physics constraints or animate them with `useFrame`.
    4. Optimize: run `gltfpack` or `gltf-transform` to compress and prune the model. Consider `meshopt`/`draco` compression and KTX2/Basis for textures for faster downloads.

- **Quick code snippet to load a GLB (use in `CarModel.jsx`)**:

```js
import { useGLTF } from '@react-three/drei'
export function CarModel(props) {
  const gltf = useGLTF('/assets/models/G87/model.glb')
  return <primitive object={gltf.scene} {...props} />
}
```

Replace the placeholder in `src/Vehicle.jsx` with `<CarModel />` once `CarModel.jsx` is added.

If you want, I can:
- download specific CC0 textures and add them to `public/assets/...` now, or
- list 3 candidate paid G87 GLB models with links and license summaries for you to review.
