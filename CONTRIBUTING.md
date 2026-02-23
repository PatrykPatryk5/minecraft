# 🛠️ Contributing to Better Minecraft

First off, thank you for considering contributing to this project! We are building the future of browser-based voxel engines, and we want you to be a part of it.

## 🌟 Our Philosophy: "Better Minecraft"
We aren't just cloning Minecraft; we are building **Better Minecraft**. Our goal is to:
1.  **Surpass Performance**: 60+ FPS on mobile and low-end hardware.
2.  **Modernize Mechanics**: Add features, tools, and magic that original Minecraft lacks.
3.  **Community-Driven**: If a feature is "cool" and doesn't break performance, it belongs here.

## 🚀 How Can I Contribute?

### 1. Code Optimizations
Voxel engines are performance-heavy. If you see a way to reduce draw calls, optimize meshing algorithms (like our Greedy Meshing), or improve Web Worker efficiency — we want your PR.

### 2. New Features (Non-Canon)
Don't feel restricted by Minecraft's vanilla features. Want to add a grappling hook? A complex magic system? A new dimension? **Go for it.** Just ensure it feels premium and polished.

### 3. Bug Fixes
Multiplayer synchronization (P2P) and Physics (Rapier) are complex areas always in need of testing and bug squashing.

## 📋 Technical Standards

-   **Language**: Strictly **TypeScript (.ts, .tsx)**.
-   **Rendering**: Use **React Three Fiber (R3F)** and **Three.js** standards. Keep mesh geometry efficient.
-   **Physics**: Calculations should ideally happen within the fixed-step loop (20 TPS) to maintain consistency.
-   **Shaders**: GLSL code should be commented and optimized for mobile GPUs.

## 🔃 Pull Request Process

1.  **Fork** the repository and create your branch from `main`.
2.  **Test** your changes in both "Potato" and "Fabulous" graphics modes.
3.  **Document** any new features or API hooks you add.
4.  **Submit** your PR with a clear description of what changed and why.

## 🎨 Creative Standards
-   Avoid "placeholders". Use procedural generation or high-quality assets.
-   Make it feel premium. Subtle animations, smooth transitions, and rich colors are preferred.

---

Let's build something legendary! 🚀
