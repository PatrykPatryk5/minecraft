# 🛠️ Współpraca — Contributing to Minecraft R3F

Dziękujemy za chęć współpracy! Ten projekt to pełna implementacja Minecrafta w przeglądarce i zawsze szukamy osób, które pomogą go rozwijać.

---

## 🌟 Filozofia projektu

Nie kopiujemy Minecrafta 1:1 — budujemy **lepszą wersję**. Nasze cele:

1. **Wydajność ponad wszystko**: 60+ FPS na każdym sprzęcie dzięki greedy meshing, Web Workers i Rapier WASM
2. **Wierna mechanika**: System craftingu, kopania, walki i fizyki zgodny z oryginałem (Java Edition)
3. **Rozszerzalność**: Nowe bloki, moby, wymiary i mechaniki wykraczające poza vanilla Minecraft
4. **Jakość kodu**: Strict TypeScript, React best practices, zero any (tam gdzie to możliwe)

---

## 🚀 Jak mogę pomóc?

### 1. Optymalizacje wydajności
Silniki voxelowe są wymagające. Szukamy PRów, które:
- Zmniejszają liczbę draw calls (ulepszone greedy meshing w `meshingUtils.ts`)
- Optymalizują Web Workers (`workerPool.ts` — pula wątków generujących chunk'i)
- Redukują garbage collection (pooling Vector3, reuse bufferów)
- Przyspieszają raycasting (`Player.tsx` — `raycastBlock()`)

### 2. Nowe bloki i przedmioty
Dodawanie nowych bloków wymaga zmian w **trzech plikach**:

| Plik | Co dodać |
|---|---|
| `src/core/blockTypes.ts` | ID w enum `BlockType` + wpis w `BLOCK_DATA` (nazwa, kolor, twardość, narzędzie) |
| `src/core/textures.ts` | Proceduralna funkcja rysująca (np. `drawMyBlock()`) + case w `drawBlockTexture()` |
| `src/core/crafting.ts` | Receptura craftingu (opcjonalnie) |

### 3. Nowe mechaniki gry
- **Moby**: Dodawaj nowe typy mobów w `src/mobs/MobSystem.ts` (AI, spawning, drop)
- **Encje**: Nowe encje fizyczne w `src/entities/` (np. łodzie, minecart'y)
- **Wymiary**: Rozszerzanie generowania terenu w `src/core/dimensionGen.ts`
- **Redstone**: Nowe komponenty w `src/core/redstoneSystem.ts`

### 4. UI i UX
- Ekrany w `src/ui/` — React JSX + CSS z `styles.css`
- HUD w `src/ui/HUD.tsx` — pasek zdrowia, głodu, tlenu
- Ustawienia w `src/ui/PauseMenu.tsx`

### 5. Multiplayer i sieć
- Protokół w `src/multiplayer/protocol.ts`
- Połączenie PeerJS w `src/multiplayer/ConnectionManager.ts`
- Serwer relay w `server/server.ts`

### 6. Bug fixy
Obszary wymagające szczególnej uwagi:
- Fizyka gracza (`Player.tsx` — kolizje, step-climbing, pływanie)
- Synchronizacja multiplayer (ConnectionManager — delta bloków)
- Symulacja płynów (waterSystem, lavaSystem — edge cases)
- Craftowanie (crafting.ts — nowe receptury, shape matching)

---

## 📋 Standardy techniczne

### Język i typowanie
- **TypeScript** (`.ts`, `.tsx`) — bez wyjątków
- **Strict mode** — `tsconfig.json` ma włączone ścisłe sprawdzanie typów
- Unikaj `any` — używaj `unknown` lub odpowiednich generics

### Rendering
- Używaj **React Three Fiber (R3F)** — nigdy czystego Three.js w komponentach
- Geometria musi być wydajna — preferuj `BufferGeometry` i `InstancedMesh`
- Unikaj tworzenia obiektów w `useFrame()` — pooluj Vector3, Quaternion, Matrix4

### Fizyka
- Obliczenia fizyczne w pętli fixed-step (20 TPS, `TICK_RATE = 0.05`)
- Nigdy nie modyfikuj pozycji gracza poza pętlą fizyki
- Rapier: używaj kinematycznych ciał dla gracza, dynamicznych dla encji

### Tekstury
- Wszystkie tekstury bloków są **proceduralnie generowane** w `textures.ts`
- Canvas 16×16 pikseli — użyj funkcji `px(ctx, x, y, r, g, b)` do rysowania
- Dodaj `case BlockType.MY_BLOCK: drawMyBlock(ctx, seed); return;` w `drawBlockTexture()`

### Stan gry
- Cały stan w jednym Zustand store (`gameStore.ts`)
- Immutable updates: `set((s) => ({ ...s, field: newValue }))`
- Komponenty subskrybują selektory: `useGameStore((s) => s.health)`

---

## 🔃 Proces Pull Request

### Przed wysłaniem PR:

1. ✅ **Fork** repozytorium i utwórz branch z `main`
2. ✅ **Sprawdź TypeScript**: `npx tsc --noEmit` — musi przejść z **0 błędami**
3. ✅ **Przetestuj ręcznie**: `npm run dev` — sprawdź zmiany w Survival i Creative
4. ✅ **Sprawdź build**: `npm run build` — upewnij się, że produkcyjna wersja się buduje
5. ✅ **Opisz zmiany**: W opisie PR wyjaśnij **co** zmieniłeś, **dlaczego** i **jak** to przetestowałeś

### Checklist PR:

```markdown
- [ ] `npx tsc --noEmit` — 0 błędów
- [ ] `npm run build` — sukces
- [ ] Przetestowano w trybie Survival
- [ ] Przetestowano w trybie Creative
- [ ] Brak regresji w istniejących funkcjach
- [ ] Dodano komentarze do złożonego kodu
```

---

## 🎨 Standardy wizualne

- ❌ **Bez placeholderów** — generuj proceduralnie lub używaj pixel artu
- ✅ **Spójność z Minecraftem** — paleta kolorów, proporcje bloków, styl UI
- ✅ **Animacje** — subtelne micro-animacje (migotanie pochodni, oddychanie serduszek)
- ✅ **Responsywność** — UI musi działać na mobile (MobileControls.tsx)
- ✅ **Polskie tłumaczenia** — wszystkie stringi w grze są po polsku

---

## 📏 Konwencje nazewnictwa

| Element | Konwencja | Przykład |
|---|---|---|
| Bloki (enum) | UPPER_SNAKE_CASE | `BlockType.DIAMOND_PICKAXE` |
| Funkcje | camelCase | `drawBow()`, `spreadWater()` |
| Komponenty React | PascalCase | `ArrowsManager`, `HUD` |
| Pliki TSX | PascalCase | `Player.tsx`, `HUD.tsx` |
| Pliki TS | camelCase | `blockTypes.ts`, `crafting.ts` |
| CSS klasy | kebab-case | `.hotbar-slot`, `.health-bar` |

---

## 🐛 Raportowanie błędów

Utwórz Issue z:
1. **Opis** — co nie działa
2. **Kroki reprodukcji** — jak wywołać błąd
3. **Oczekiwane zachowanie** — co powinno się stać
4. **Aktualne zachowanie** — co się dzieje zamiast tego
5. **Środowisko** — przeglądarka, system operacyjny

---

Zbudujmy coś legendarnego! 🚀⛏
