# ⛏ Minecraft — React Three Fiber

> Pełna gra Minecraft zbudowana od zera w przeglądarce  
> React Three Fiber · Three.js · Rapier Physics · TypeScript · Zustand · PeerJS

**Wersja 4.0.0** — Made by **MUZYKANT TEAM** ([muzykant.xyz](https://muzykant.xyz))

---

## 📋 Spis treści

- [Funkcje gry](#-funkcje-gry)
- [Architektura techniczna](#-architektura-techniczna)
- [Struktura projektu](#-struktura-projektu)
- [Uruchamianie](#-uruchamianie)
- [Sterowanie](#-sterowanie)
- [Stack technologiczny](#-stack-technologiczny)
- [Licencja](#-licencja)

---

## 🎮 Funkcje gry

### Tryby gry
| Tryb | Opis |
|---|---|
| **Survival** | Kopanie, craftowanie, walka z mobami, system głodu i zdrowia |
| **Creative** | Nieograniczone bloki, latanie, brak obrażeń |
| **Spectator** | Swobodne przemieszczanie się przez bloki, obserwacja świata |

### Świat i generowanie
- **Proceduralne generowanie terenu** z szumem Perlin/Simplex (biomy: pustynia, las, tundra, oceany, góry)
- **3 wymiary**: Overworld, Nether i End z systemem portali
- **Jaskinie, rudy i struktury** (drzewa, kaktusy) generowane automatycznie
- **Głębinowe rudy** (deepslate) poniżej Y=16
- **Chunk'i 16×256×16** przechowywane jako `Uint16Array` dla wydajności

### Bloki i przedmioty (300+)
- **Bloki budowlane**: Kamień, drewno (dąb, świerk, brzoza, wiśnia, mangrowe, bambus), cegły, piaskowiec, kwarc, blackstone, deepslate, miedź, basalt, tuff, kalcyt, ametyst
- **Rudy**: Węgiel, żelazo, złoto, diament, szmaragd, lapis lazuli, redstone, miedź (+ warianty deepslate)
- **Wełna**: 6 kolorów (biała, czerwona, niebieska, zielona, żółta, czarna)
- **Szkło, szkło barwione, tafle szklane**
- **Nether**: Netherrack, soul sand, glowstone, nether bricks, ancient debris, netherite, crimson/warped stem i deski
- **End**: End stone, smocze jajo, purpur, end bricks
- **Deep Dark**: Sculk, sculk sensor, sculk catalyst, sculk shrieker
- **Lush Caves**: Mech, azalee, spore blossom, dripstone
- **Narzędzia**: Drewniane, kamienne, żelazne, złote, diamentowe, netheritowe (kilof, siekiera, łopata, motyka, miecz)
- **Zbroja**: Skórzana, żelazna, złota, diamentowa (hełm, napierśnik, spodnie, buty)
- **Broń**: Łuk ze strzałami (fizyka Rapier, uszkadzanie mobów, wbijanie się w bloki)
- **Jedzenie**: Jabłko, chleb, wieprzowina, wołowina, kurczak, dorsz, łosoś, złote jabłko, ciasto, grzyby
- **Przedmioty użytkowe**: Wiadro (woda/lawa), krzesiwo, nożyce, kompas, zegar, smycz, wędka

### Fizyka i mechanika
- **Fizyka Rapier WASM** z ustaloną częstotliwością 20 TPS (ticków/sekundę)
- **Pływanie i tonięcie**: Fizyka pływalności, opór wody, miernik tlenu, obrażenia z tonięcia
- **Łucznictwo**: Naciąganie łuku (PPM), zoom FOV, strzały z fizyką grawitacyjną, kolizja z blokami i mobami
- **Eksplozje TNT**: Knockback gracza i niszczenie bloków w promieniu wybuchu
- **Ścinanie drzew**: Ścięcie pnia niszczy rekurencyjnie połączone pnie i liście
- **Gąbka**: Pochłania wodę w promieniu 5 bloków (Manhattan distance)
- **Obrażenia od upadku**: System z progiem, odbijanie na bloku slime, redukcja na beli siana
- **Bloki grawitacyjne**: Piasek i żwir spadają fizycznie w dół
- **Lód**: Poślizg (zmienione tarcie i przyspieszenie)
- **Magma**: Obrażenia przy staniu na bloku (chyba że sneak)

### Redstone i mechanizmy
- **System Redstone**: Propagacja mocy BFS, zanik sygnału o 1 na blok
- **Dźwignia, przycisk, pochodnia redstone**
- **Lampa Redstone, blok redstone, przewód redstone**
- **Tłoki i tłoki lepkie**: Pchanie bloków, obliczanie kierunku
- **Szafka grająca (Jukebox)**: Z odtwarzaniem płyt

### Woda i lawa
- **Symulacja płynów**: Automatyczne rozprzestrzenianie wody i lawy (automat komórkowy)
- **Obsługa wiader**: Wiadro wody, wiadro lawy — zbieranie i rozlewanie
- **Obrażenia od lawy**: Kontaktowe obrażenia + spowolnienie ruchu
- **Interakcja wody i lawy**: Tworzenie obsydianu/kamienia

### Rolnictwo
- **System upraw**: Sadzenie nasion, 8 etapów wzrostu pszenicy, nawóz (mączka kostna)
- **Ziemia uprawna (Farmland)**: Specjalny blok pod uprawy
- **Kaktusy**: Automatyczny wzrost do 3 bloków

### System craftingu i smelting
- **Stół crafting'owy**: Siatka 3×3, 150+ receptur
- **Piec**: Wytapianie rud, gotowanie jedzenia, prażenie bloków
- **Ekran inwentarza**: Drag-and-drop, dzielenie stacków, szybki transfer

### Moby i walka
- **System mobów**: AI z pathfindingiem (A*), różne typy zachowań
- **Obrażenia narzędziami**: System obrażeń per ID narzędzia (drewniane=4, kamienne=5, żelazne=6, diamentowe=7)
- **Mnożniki prędkości kopania**: Wood×2, Stone×4, Iron×6, Diamond×8, Netherite×9, Gold×12
- **Ender Dragon**: Boss walka w wymiarze End z kryształami End
- **Throwables**: Śnieżki, perły Endera z fizyką

### Interfejs użytkownika
- **HUD**: Pasek zdrowia (serduszka), pasek głodu, pasek doświadczenia, pasek tlenu
- **Hotbar**: 9 slotów z podglądem przedmiotów, pasek wytrzymałości narzędzi
- **Ekran pauzy**: Ustawienia grafiki i dźwięku, zapis i powrót do menu
- **Ekran śmierci**: Przyczyna śmierci, przycisk respawn
- **Ekran debugowania (F3)**: Pozycja, biom, chunk, FPS, ping
- **Chat**: System wiadomości z kodami kolorów Minecraft (§a, §e)
- **Ekran multiplayer**: Dołączanie po kodzie, lista graczy
- **Ekran credits**: Po pokonaniu Ender Dragona
- **Sterowanie mobilne**: MobileControls z wirtualnym D-padem
- **Error Boundary**: Ochrona przed crashami z opcją "Zapisz i wróć do menu"

### Środowisko
- **Cykl dnia i nocy**: Dynamiczne oświetlenie, pozycja słońca/księżyca, gwiazdy
- **Pogoda**: Deszcz (z wiatrem), śnieg, burza z błyskawicami
- **Chmury**: Animowane chmury z parallaxą
- **Oświetlenie**: Pochodnie, lampiony, glowstone, latarnie, pochodnie redstone — z efektem migotania
- **Powierzchnia wody**: Animowana z refleksami
- **Stół enchanting'owy**: Animacja latającej książki z cząsteczkami
- **Animowane skrzynie**: Otwieranie/zamykanie pokrywy

### Multiplayer
- **PeerJS (WebRTC)**: Bezpośrednie połączenie P2P między graczami
- **Serwer relay**: Fastify + WebSocket jako fallback, gdy P2P nie działa
- **Protokół binarny**: Synchronizacja delty bloków, pozycji graczy, wiadomości chatu
- **Lista graczy (Tab)**: Pokazuje połączonych graczy z pingiem
- **Join/Leave**: Wiadomości systemowe z kodami kolorów

### Zapis i ładowanie
- **IndexedDB**: Zapis świata, inwentarza, hotbara, zbroi, trybu gry, pozycji gracza
- **Automatyczny zapis**: Batched save per tick, chroniący przed utratą danych
- **Wielokrotne światy**: Obsługa wielu zapisanych światów

---

## 🏗️ Architektura techniczna

### Dane voxeli
- Chunki `16×256×16` jako płaskie `Uint16Array` (zero garbage collection)
- Indeksowanie bitowe: `index = x | (z << 4) | (y << 8)` — O(1) lookup
- Zapis do IndexedDB z deduplikacją i batchingiem

### Generowanie świata (Multi-Thread)
- **Web Worker Pool** (`workerPool.ts`): Generowanie terenu w tle na wielu wątkach
- **Cancelacja starych requestów**: `cancelStale()` automatycznie anuluje chunki, które gracz już minął
- **Szum wielowarstwowy**: Perlin + Simplex → kontynentalność, erozja, temperatura, wilgotność → biomy
- **Generowanie wymiarów**: Osobna logika dla Netheru i Endu (`dimensionGen.ts`)

### Rendering (React Three Fiber)
- **Greedy Meshing** (`meshingUtils.ts`): Łączenie sąsiednich identycznych ścian w jeden quad — redukcja draw calls o ~90%
- **Proceduralny atlas tekstur** (`textures.ts`, 104KB): 300+ bloków rysowanych proceduralnie w canvas 16×16
- **Post-processing**: Opcjonalny bloom, SSAO, depth of field
- **Chunk culling**: Renderowanie tylko widocznych chunków

### Fizyka (Rapier WASM)
- **Kinematyczny kontroler gracza**: Własna kolizja AABB z step-climbing i sneak-edge
- **Stała częstotliwość 20 TPS**: Fizyka oddzielona od FPS renderu
- **CCD**: Continuous Collision Detection dla szybkich pocisków (strzały)
- **Rigid body strzał**: Pełne ciała fizyczne z grawitacją i kolizją

### Sieć (PeerJS + Fastify)
- **WebRTC P2P**: Bezpośrednie połączenie między graczami (niski ping)
- **Relay server**: Fastify + WebSocket jako backup gdy NAT blokuje P2P
- **Binary protocol** (`protocol.ts`): Optymalizowany protokół binarny dla pakietów

### Stan gry (Zustand)
- **Centralny store** (`gameStore.ts`): Jeden Zustand store ze wszystkimi stanami gry
- **Selektory**: Komponenty subskrybują tylko potrzebne fragmenty stanu
- **Niezmienniki**: Immutable updates z spread operator

---

## 📁 Struktura projektu

```
minecraft/
├── index.html              # Punkt wejścia z ekranem ładowania
├── package.json            # Zależności (React 19, Three.js, Rapier, PeerJS)
├── vite.config.ts          # Konfiguracja Vite + React plugin
├── tsconfig.json           # Konfiguracja TypeScript (strict mode)
├── server/                 # Serwer relay multiplayer
│   ├── server.ts           # Fastify + WebSocket
│   └── protocol.js         # Binarny protokół sieciowy
└── src/
    ├── main.tsx            # Punkt wejścia React
    ├── App.tsx             # Główny komponent z R3F Canvas
    ├── core/               # Silnik gry (21 modułów)
    │   ├── blockTypes.ts     # 300+ typów bloków (enum + BLOCK_DATA)
    │   ├── textures.ts       # Proceduralny atlas tekstur (104KB)
    │   ├── terrainGen.ts     # Generator terenu z biomami
    │   ├── crafting.ts       # 150+ receptur craftingu
    │   ├── waterSystem.ts    # Symulacja wody + gąbki
    │   ├── lavaSystem.ts     # Symulacja lawy
    │   ├── redstoneSystem.ts # System Redstone (BFS)
    │   ├── pistonSystem.ts   # Tłoki i tłoki lepkie
    │   ├── portalSystem.ts   # Portale Nether i End
    │   ├── farmingSystem.ts  # System upraw
    │   ├── blockActions.ts   # Akcje bloków (łamanie, eksplozje, drzewa)
    │   ├── workerPool.ts     # Wielowątkowy pool generowania chunków
    │   ├── storage.ts        # Zapis/odczyt IndexedDB
    │   ├── worldTick.ts      # Game tick (wzrost roślin, random ticks)
    │   ├── gravityBlocks.ts  # Fizyka piasku/żwiru
    │   ├── meshingUtils.ts   # Greedy meshing
    │   ├── particles.ts      # System cząsteczek
    │   ├── dimensionGen.ts   # Generowanie Nether/End
    │   └── renderer.ts       # Chunk rendering pipeline
    ├── player/             # Logika gracza
    │   └── Player.tsx        # Fizyka, kolizja, kopanie, walka, łucznictwo
    ├── store/              # Stan gry
    │   └── gameStore.ts      # Zustand store (centralne źródło prawdy)
    ├── ui/                 # Interfejs użytkownika (21 ekranów)
    │   ├── HUD.tsx           # Serduszka, głód, tlen, hotbar
    │   ├── Inventory.tsx     # Ekran inwentarza
    │   ├── CraftingScreen.tsx # Ekran craftingu 3×3
    │   ├── FurnaceScreen.tsx # Ekran pieca z animacją
    │   ├── ChestScreen.tsx   # Ekran skrzyni
    │   ├── MainMenu.tsx      # Menu główne
    │   ├── PauseMenu.tsx     # Menu pauzy z ustawieniami
    │   ├── DeathScreen.tsx   # Ekran śmierci
    │   ├── DebugScreen.tsx   # F3 debug info
    │   ├── ChatBox.tsx       # Chat multiplayer
    │   └── styles.css        # 40KB CSS (animacje, responsive)
    ├── entities/           # Encje fizyczne (7 typów)
    │   ├── Arrows.tsx        # Strzały z fizyką Rapier
    │   ├── DroppedItems.tsx  # Upuszczone przedmioty
    │   ├── FallingBlocks.tsx # Spadające bloki (piasek, żwir)
    │   ├── TNTPrimed.tsx     # Aktywowane TNT
    │   ├── Throwables.tsx    # Śnieżki, perły Endera
    │   ├── EndCrystal.tsx    # Kryształy Endu
    │   └── EnderDragon.tsx   # Boss Ender Dragon
    ├── mobs/               # System mobów
    │   ├── MobSystem.ts      # AI, spawning, obrażenia
    │   ├── MobRenderer.tsx   # Renderowanie mobów (voxel art)
    │   └── pathfinding.ts    # Algorytm A* do pathfindingu
    ├── environment/        # Środowisko wizualne
    │   ├── DayNightCycle.tsx  # Słońce, księżyc, gwiazdy
    │   ├── Weather.tsx       # Deszcz, śnieg, burza
    │   ├── Clouds.tsx        # Animowane chmury
    │   ├── WaterSurface.tsx  # Animowana woda
    │   ├── TorchLights.tsx   # Migotanie pochodni
    │   ├── AnimatedChest.tsx # Animowane skrzynie
    │   └── EnchantingTables.tsx # Animowane stoły enchanting
    ├── multiplayer/        # Sieć
    │   ├── ConnectionManager.ts # PeerJS + WebRTC + Relay
    │   ├── protocol.ts        # Binarny protokół
    │   └── MultiplayerRenderer.tsx # Renderowanie innych graczy
    ├── effects/            # Efekty wizualne
    └── audio/              # System dźwięku
```

---

## ⚙️ Uruchamianie

### Wymagania
- **Node.js** 18+
- **npm** 9+

### Instalacja i uruchomienie
```bash
git clone https://github.com/PatrykPatryk5/minecraft.git
cd minecraft
npm install
npm run dev
```
Gra będzie dostępna pod `http://localhost:5173`.

### Budowanie produkcyjne
```bash
npm run build
npm run preview
```

### Serwer multiplayer
```bash
cd server
npm install
npm start
```

---

## 🎮 Sterowanie

### Klawiatura i mysz
| Klawisz | Akcja |
|---|---|
| `W` / `A` / `S` / `D` | Ruch (przód/lewo/tył/prawo) |
| `Spacja` | Skok / Pływanie w górę / Latanie w górę (Creative) |
| `Shift` | Sprint |
| `Ctrl` | Skradanie się (Sneak) — blokuje spadanie z krawędzi |
| `Lewy przycisk myszy` | Kopanie / Atak |
| `Prawy przycisk myszy` | Stawianie bloku / Użycie przedmiotu / Naciąganie łuku |
| `E` | Otwieranie inwentarza |
| `F3` | Ekran debugowania (pozycja, FPS, biom, chunk) |
| `1` — `9` | Selekcja slotu hotbara |
| `T` | Otwieranie chatu |
| `Q` | Upuszczenie przedmiotu |
| `Escape` | Menu pauzy |
| `Tab` | Lista graczy (multiplayer) |

### Latanie (Creative)
- Naciśnij `Spacja` dwa razy szybko → włączenie/wyłączenie latania
- `Spacja` → w górę, `Shift` → w dół

### Łucznictwo
- Trzymaj **łuk** w hotbarze i **strzały** w inwentarzu
- Przytrzymaj **prawy przycisk myszy** → łuk się naciąga (FOV zoom)
- Puść → strzała leci z fizyką grawitacyjną

---

## 🛠️ Stack technologiczny

| Technologia | Wersja | Zastosowanie |
|---|---|---|
| [React](https://react.dev) | 19.2 | UI i komponentowy rendering |
| [Three.js](https://threejs.org) | 0.183 | Silnik 3D (WebGL) |
| [React Three Fiber](https://r3f.docs.pmnd.rs) | 9.5 | React renderer dla Three.js |
| [Rapier](https://rapier.rs) | via @react-three/rapier 2.2 | Fizyka WASM (kolizje, rigid body) |
| [Zustand](https://zustand.docs.pmnd.rs) | 5.0 | Zarządzanie stanem gry |
| [PeerJS](https://peerjs.com) | 1.5 | P2P WebRTC multiplayer |
| [Vite](https://vitejs.dev) | 7.3 | Build tool + dev server |
| [TypeScript](https://typescriptlang.org) | 5.9 | Typowanie statyczne |
| [Fastify](https://fastify.dev) | 5.7 | Serwer relay (multiplayer) |
| [simplex-noise](https://github.com/jwagner/simplex-noise) | 4.0 | Generowanie terenu |
| [idb-keyval](https://github.com/nicedoc/idb-keyval) | 6.2 | Zapis światów (IndexedDB) |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | 0.9 | Szybki raycasting BVH |

---

## 🤝 Współpraca
Zapraszamy do współpracy! Zobacz [CONTRIBUTING.md](CONTRIBUTING.md).

## ⚖️ Licencja
Projekt jest objęty licencją **Custom Source-Available License**. Zobacz [LICENSE](LICENSE).

---

📧 Kontakt: **[r3f@muzykant.xyz](mailto:r3f@muzykant.xyz)** | [muzykant.xyz](https://muzykant.xyz)

*Stworzone z 💖 przez PatrykPatryk5 i MUZYKANT TEAM.*
