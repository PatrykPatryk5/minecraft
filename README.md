# 🎮 Better Minecraft: High-Performance Voxel Engine (R3F + TypeScript)

Welcome to **Better Minecraft**, a bleeding-edge, hyper-optimized Minecraft clone built from the ground up using **React Three Fiber (R3F)**, **Three.js**, and **TypeScript**. 

This project aims to surpass the original game by leveraging modern web technologies, aggressive performance optimizations, and a robust scripting mod system.

---

## 🏗️ System Architecture: The A to Z Technical Deep-Dive

This engine is designed to handle millions of voxels at 60+ FPS in the browser. Below is an exhaustive breakdown of how every component works.

### A. Voxel Data & Storage
- **Chunk-Based Memory**: The world is divided into $16 \times 24 \times 16$ chunks. 
- **1D Array Optimization**: Each chunk stores block data in a single `Uint16Array` to minimize garbage collection and memory overhead.
- **Coordinate Hashing**: We use bitwise shifting for rapid coordinate-to-index translation: `index = x | (z << 4) | (y << 8)`.

### B. World Generation Lifecycle
- **Multi-Threaded Generation**: Terrain generation happens in a pool of **Web Workers** via `workerPool.ts`. This ensures zero main-thread blocking during world traversal.
- **Noise Pipelines**: We utilize tiered Perlin and Simplex noise for biomes:
    - **Continentalness**: Determines land vs. ocean.
    - **Erosion**: Governs mountain height.
    - **Temperature/Humidity**: Selects biomes (Desert, Forest, Tundra).
- **Structure Injection**: Strongholds, villages, and caves are injected into the voxel buffer before the mesh is generated.

### C. The Rendering Pipe (R3F + Custom Shaders)
- **Greedy Meshing**: An algorithm in `meshingUtils.ts` that combines adjacent identical block faces into a single large quad. This reduces draw calls and vertex count by up to 90%.
- **Custom Shaders (GLSL)**:
    - **Emissive Flow**: Lawa and Glowstone use emissive UV shifting for a "pulse" effect without additional lights.
    - **Atmospheric Scattering**: Custom fog shaders that simulate depth and humidity.
    - **Vegetation Sway**: Vertex shaders apply sinusoidal movement to flora based on world-space coordinates.
- **Texture Atlas management**: High-speed procedural generation of 16x16 texture atlases in `textures.ts` to allow for thousands of custom block types.

### D. Physics & Collision (Rapier WASM)
- **Kinematic Player Controller**: Player movement is handled via a **Rapier** kinematic character controller, allowing for pixel-perfect step-climbing and friction calculation.
- **Fixed Timestep (20 TPS)**: Physics calculations are decoupled from the render frame rate (60/144 FPS) to ensure consistent movement across different hardware.
- **AABB vs. Mesh**: While blocks use simple AABB (Axis-Aligned Bounding Boxes), complex entities use `three-mesh-bvh` for high-speed raycasting/collision detection.

### E. Networking & Multiplayer (P2P Hybrid)
- **PeerJS Integration**: Direct P2P (WebRTC) communication for ultra-low latency.
- **Relay Fallback**: Automatic transition to a TURN/Relay server if direct P2P is blocked by firewalls.
- **Binary Delta Compression**: We send only the *changes* in voxel data (Deltas) over the network using `SharedArrayBuffer` for zero-copy synchronization.

### F. Fluid Simulation & Logic
- **Cellular Automata Fluids**: Water and Lava flow using a voxel-based CA system. Fluids check adjacent blocks and "flow" into empty spaces with a depth-decay logic.
- **Redstone Power Propagation**: A Breadth-First Search (BFS) algorithm handles power levels. Signal strength decays by 1 block per step, supporting repeaters and redstone torches.
- **Optimized Random Ticks**: Instead of scanning entire chunks, the engine picks random indices within active chunks to process growth, decay, and environmental updates (e.g., grass spreading, crop growth).

### G. Asset Management
- **Resource Pack Manager**: Supports dynamic loading of custom JSON-based packs that override textures and sound mappings without restarts.
- **Procedural Soundscapes**: Dynamic frequency filtering in `sounds.ts` adjusts environment audio (cave reverb, underwater muffling) based on player depth.

---

## 🌟 Our Vision: Beyond the Original
We believe the browser is a world-class gaming platform. **Better Minecraft** is built for:
- **Natively Cross-Platform**: Play on mobile, tablet, or desktop with specialized UI for each.
- **Surpassing "Vanilla"**: Adding features like Grappling Hooks, Procedural Magic, and Infinity-Biomes that go beyond the limitations of original Minecraft.
- **Modding First**: A built-in **Scripting Mod API** (BETA) allows developers to inject JS logic directly into the game loop.

---

## 🧩 Modding & Extensibility
- **Resource Packs**: Drop in a folder of PNGs to overhaul the entire world.
- **Plugin System**: Hook into events like `onBlockBreak`, `onTick`, or `onEntitySpawn` using our custom Proxy-based API.

---

## 🚀 Performance Monitoring
We've integrated `r3f-perf` and custom telemetry to monitor:
- **Draw Calls**: Kept under 100 for a stable 60 FPS.
- **VRAM Usage**: Optimized via texture compression and chunk pooling.
- **Workers Health**: Real-time monitoring of world gen thread latency.

---

## ⚙️ Local Development
1. **Prerequisites**: Node.js 18+
2. **Clone**: `git clone https://github.com/PatrykPatryk5/minecraft.git`
3. **Setup**: `npm install`
4. **Dev**: `npm run dev`

---

## 🤝 Community & License
- **Contributions**: We welcome all PRs! See [CONTRIBUTING.md](file:///c:/Users/micha/Downloads/warka/minecraft/CONTRIBUTING.md) for guidelines.
- **License**: This project is under a **Custom Source-Available License**. See [license.md](file:///c:/Users/micha/Downloads/warka/minecraft/license.md) for details.

📧 Contact: **[r3f@muzykant.xyz](mailto:r3f@muzykant.xyz)** | [muzykant.xyz](https://muzykant.xyz)

*Crafted with 💖 by PatrykPatryk5 and the MUZYKANT TEAM.*
