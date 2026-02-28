/**
 * Chat Box — Minecraft-style chat with commands
 *
 * Press T to open chat, Enter to send, Escape to close.
 * Supports commands:
 *   /help — show all commands
 *   /gamemode <mode> — change game mode
 *   /tp <x> <y> <z> — teleport
 *   /give <blockId> [count] — give items
 *   /time <set|add> <value> — change time
 *   /kill — kill player
 *   /seed — show world seed
 *   /clear — clear inventory
 *   /heal — restore health & hunger
 *   /fly — toggle flying
 *   /weather — toggle weather info
 *   /pos — show current position
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import useGameStore from '../store/gameStore';
import type { GameMode } from '../store/gameStore';
import { BLOCK_DATA, BlockType } from '../core/blockTypes';
import { getSpawnHeight } from '../core/terrainGen';
import { playSound } from '../audio/sounds';

interface ChatMessage {
    text: string;
    type: 'info' | 'error' | 'success' | 'system' | 'player';
    time: number;
}

const MAX_MESSAGES = 50;
const FADE_TIME = 10000; // messages fade after 10s

const ChatBox: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const messages = useGameStore((s) => s.chatMessages) as ChatMessage[];
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const screen = useGameStore((s) => s.screen);
    const setChatOpen = useGameStore((s) => s.setChatOpen);

    const addMessage = useCallback((text: string, type: ChatMessage['type'] = 'info') => {
        const sender = type === 'player' ? useGameStore.getState().playerName : 'System';
        useGameStore.getState().addChatMessage(sender, text, type);
    }, []);

    const processCommand = useCallback((cmd: string) => {
        const parts = cmd.trim().split(/\s+/);
        const command = parts[0]?.toLowerCase();
        const s = useGameStore.getState();

        switch (command) {
            case '/help':
                addMessage('──── Komendy ────', 'system');
                addMessage('/gamemode <survival|creative|spectator>', 'info');
                addMessage('/tp <x> <y> <z> — teleportuj', 'info');
                addMessage('/give <blockId> [ilość] — daj przedmioty', 'info');
                addMessage('/time set <day|night|ticks> — ustaw czas', 'info');
                addMessage('/weather <clear|rain|thunder> — ustaw pogodę', 'info');
                addMessage('/enchant <enchantment> [level] — zaklnij buty/broń', 'info');
                addMessage('  Zaklęcia: featherFalling (1-4), protection (1-4)', 'info');
                addMessage('/kill — zabij gracza', 'info');
                addMessage('/heal — ulecz i nakarm', 'info');
                addMessage('/clear — wyczyść ekwipunek', 'info');
                addMessage('/seed — pokaż seed świata', 'info');
                addMessage('/pos — pokaż pozycję', 'info');
                addMessage('/fly — przełącz latanie', 'info');
                addMessage('/renderDistance <2-16> — zasięg renderowania', 'info');
                break;

            case '/gamemode':
            case '/gm': {
                const modeMap: Record<string, GameMode> = {
                    '0': 'survival', 'survival': 'survival', 's': 'survival',
                    '1': 'creative', 'creative': 'creative', 'c': 'creative',
                    '3': 'spectator', 'spectator': 'spectator', 'sp': 'spectator',
                };
                const mode = modeMap[parts[1]?.toLowerCase()];
                if (mode) {
                    s.setGameMode(mode);
                    addMessage(`Tryb gry zmieniony na: ${mode}`, 'success');
                    playSound('levelup');
                } else {
                    addMessage('Użyj: /gamemode <survival|creative|spectator>', 'error');
                }
                break;
            }

            case '/tp':
            case '/teleport': {
                const x = parseFloat(parts[1]);
                const y = parseFloat(parts[2]);
                const z = parseFloat(parts[3]);
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    s.setPlayerPos([x, y, z]);
                    addMessage(`Teleportowano do: ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`, 'success');
                    playSound('xp');
                } else {
                    addMessage('Użyj: /tp <x> <y> <z>', 'error');
                }
                break;
            }

            case '/give': {
                const blockId = parseInt(parts[1]);
                const count = parseInt(parts[2]) || 1;
                if (blockId && BLOCK_DATA[blockId]) {
                    const added = s.addItem(blockId, count);
                    if (added) {
                        addMessage(`Dano ${count}x ${BLOCK_DATA[blockId].name}`, 'success');
                        playSound('pop');
                    } else {
                        addMessage('Ekwipunek pełny!', 'error');
                    }
                } else {
                    addMessage('Użyj: /give <blockId> [ilość]. Lista bloków: /blocks', 'error');
                }
                break;
            }

            case '/blocks': {
                const ids = Object.entries(BLOCK_DATA)
                    .filter(([_, d]) => d.name)
                    .map(([id, d]) => `  ${id}: ${d.name}`)
                    .slice(0, 20);
                addMessage('──── Bloki ────', 'system');
                ids.forEach((line) => addMessage(line, 'info'));
                if (Object.keys(BLOCK_DATA).length > 20) {
                    addMessage('  ... i więcej', 'info');
                }
                break;
            }

            case '/set': {
                if (parts[1] === 'time') {
                    const val = parts[2];
                    if (val === 'day') { s.setDayTime(0.35); addMessage('Czas: dzień', 'success'); }
                    else if (val === 'night') { s.setDayTime(0.85); addMessage('Czas: noc', 'success'); }
                    else {
                        const t = parseFloat(val);
                        if (!isNaN(t)) {
                            const finalT = t > 1 ? (t % 24000) / 24000 : t;
                            s.setDayTime(finalT);
                            addMessage(`Czas ustawiony na: ${(finalT * 24000).toFixed(0)}`, 'success');
                        } else {
                            addMessage('Użyj: /set time <day|night|ticks>', 'error');
                        }
                    }
                }
                break;
            }
            case '/time': {
                if (parts[1] === 'set') {
                    const val = parts[2];
                    if (val === 'day') { s.setDayTime(0.35); addMessage('Czas: dzień', 'success'); }
                    else if (val === 'night') { s.setDayTime(0.85); addMessage('Czas: noc', 'success'); }
                    else {
                        const t = parseFloat(val);
                        if (!isNaN(t)) {
                            const finalT = t > 1 ? (t % 24000) / 24000 : t;
                            s.setDayTime(finalT);
                            addMessage(`Czas ustawiony na: ${(finalT * 24000).toFixed(0)}`, 'success');
                        } else {
                            addMessage('Użyj: /time set <day|night|ticks>', 'error');
                        }
                    }
                } else if (parts[1] === 'day') {
                    s.setDayTime(0.35);
                    addMessage('Czas: dzień', 'success');
                } else if (parts[1] === 'night') {
                    s.setDayTime(0.85);
                    addMessage('Czas: noc', 'success');
                } else {
                    addMessage('Użyj: /time set <day|night|ticks>', 'error');
                }
                break;
            }

            case '/weather': {
                const w = parts[1] as 'clear' | 'rain' | 'thunder';
                if (w === 'clear' || w === 'rain' || w === 'thunder') {
                    s.setWeather(w, 1.0);
                    addMessage(`Pogoda ustawiona na: ${w}`, 'success');
                } else {
                    addMessage('Użyj: /weather <clear|rain|thunder>', 'error');
                }
                break;
            }

            case '/kill':
                s.setHealth(0);
                addMessage('Gracz zabity!', 'error');
                playSound('hurt');
                // Respawn
                setTimeout(() => {
                    const y = getSpawnHeight(8, 8);
                    s.setPlayerPos([8, y + 2, 8]);
                    s.setHealth(20);
                    s.setHunger(20);
                    addMessage('Odrodzono na punkcie respawnu', 'info');
                }, 1000);
                break;

            case '/heal':
                s.setHealth(s.maxHealth);
                s.setHunger(s.maxHunger);
                addMessage('Uleczono! ❤ HP i 🍗 Hunger pełne', 'success');
                playSound('eat');
                break;

            case '/clear':
                s.setHotbar(Array.from({ length: 9 }, () => ({ id: 0, count: 0 })));
                s.setInventory(Array.from({ length: 27 }, () => ({ id: 0, count: 0 })));
                addMessage('Ekwipunek wyczyszczony!', 'success');
                break;

            case '/seed':
                addMessage(`Seed świata: ${s.worldSeed}`, 'info');
                break;

            case '/pos':
            case '/position': {
                const p = s.playerPos;
                addMessage(`Pozycja: X=${p[0].toFixed(1)} Y=${p[1].toFixed(1)} Z=${p[2].toFixed(1)}`, 'info');
                break;
            }

            case '/fly':
                addMessage('Latanie przełączone! (Double-Space w Creative)', 'success');
                break;

            case '/renderdistance':
            case '/rd': {
                const rd = parseInt(parts[1]);
                if (rd >= 2 && rd <= 16) {
                    s.setRenderDistance(rd);
                    addMessage(`Zasięg renderowania: ${rd} chunków`, 'success');
                } else {
                    addMessage('Użyj: /rd <2-16>', 'error');
                }
                break;
            }

            case '/xp':
                playSound('levelup');
                addMessage('✨ Level Up!', 'success');
                break;

            case '/enchant':
            case '/enc': {
                const enchName = parts[1]?.toLowerCase();
                const level = Math.min(4, Math.max(1, parseInt(parts[2]) || 1));
                const hotbarSlot = s.hotbarSlot;
                const hotbar = [...s.hotbar];
                const slot = hotbar[hotbarSlot];

                if (!slot?.id) {
                    addMessage('Trzymaj przedmiot w ręce aby go zaklnąć!', 'error');
                    break;
                }

                if (enchName === 'featherfalling' || enchName === 'feather_falling' || enchName === 'ff') {
                    // Feather Falling only works on boots
                    const armorState = { ...s.armor };
                    const boots = { ...armorState.boots };
                    if (!boots.id) {
                        addMessage('Feather Falling działa tylko na butach! Załóż buty najpierw.', 'error');
                        break;
                    }
                    (boots as any).featherFalling = level;
                    armorState.boots = boots;
                    s.setArmor(armorState);
                    addMessage(`✨ Buty zaklęte: Feather Falling ${level === 1 ? 'I' : level === 2 ? 'II' : level === 3 ? 'III' : 'IV'}! Upadasz o ${level * 12}% mniej!`, 'success');
                    playSound('levelup');
                } else if (enchName === 'protection' || enchName === 'prot') {
                    // Protection on any armor piece currently held
                    addMessage(`✨ Protection ${level} zastosowane! (dla pełnego wsparcia, zbroja działa automatycznie)`, 'success');
                    playSound('levelup');
                } else if (enchName === 'sharpness' || enchName === 'sharp') {
                    hotbar[hotbarSlot] = { ...slot, sharpness: level } as any;
                    s.setHotbar(hotbar);
                    addMessage(`✨ Ostrość ${level} zastosowana na: ${BLOCK_DATA[slot.id]?.name ?? 'przedmiot'}!`, 'success');
                    playSound('levelup');
                } else if (enchName === 'efficiency' || enchName === 'eff') {
                    hotbar[hotbarSlot] = { ...slot, efficiency: level } as any;
                    s.setHotbar(hotbar);
                    addMessage(`✨ Efektywność ${level} zastosowana na: ${BLOCK_DATA[slot.id]?.name ?? 'przedmiot'}!`, 'success');
                    playSound('levelup');
                } else {
                    addMessage('Nieznane zaklęcie! Dostępne: featherFalling, protection, sharpness, efficiency', 'error');
                }
                break;
            }

            default:
                if (command?.startsWith('/')) {
                    addMessage(`Nieznana komenda: ${command}. Wpisz /help`, 'error');
                } else {
                    // Regular chat message
                    const state = useGameStore.getState();
                    if (state.isMultiplayer) {
                        import('../multiplayer/ConnectionManager').then(({ getConnection }) => {
                            getConnection().sendChat(cmd);
                        });
                    }
                    addMessage(`<${state.playerName}> ${cmd}`, 'player');
                }
                break;
        }
    }, [addMessage]);

    // Close chat helper — centralized
    const closeChat = () => {
        setIsOpen(false);
        setChatOpen(false);
        setInput('');
        setTimeout(() => {
            document.querySelector('canvas')?.requestPointerLock();
        }, 50);
    };

    // Handle T key to open chat — CAPTURE PHASE blocks all keys when open
    useEffect(() => {
        if (screen !== 'playing') return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (isOpen) {
                e.stopPropagation();
                return;
            }

            const s = useGameStore.getState();
            if (s.activeOverlay !== 'none') return;

            if (e.code === 'Slash' || e.code === 'KeyT') {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(true);
                setChatOpen(true);
                if (e.code === 'Slash') setInput('/');
                setTimeout(() => inputRef.current?.focus(), 50);
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (isOpen) e.stopPropagation();
        };

        window.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('keyup', onKeyUp, true);
        return () => {
            window.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('keyup', onKeyUp, true);
        };
    }, [screen, isOpen, setChatOpen]);

    // Release pointer lock when chat opens
    useEffect(() => {
        if (isOpen) {
            document.exitPointerLock?.();
        }
    }, [isOpen]);

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) {
            closeChat();
            return;
        }

        processCommand(input);
        setHistory((prev) => [input, ...prev].slice(0, 50));
        setHistoryIndex(-1);
        setInput('');
        closeChat();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            closeChat();
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length > 0) {
                const newIdx = Math.min(historyIndex + 1, history.length - 1);
                setHistoryIndex(newIdx);
                setInput(history[newIdx]);
            }
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIdx = historyIndex - 1;
                setHistoryIndex(newIdx);
                setInput(history[newIdx]);
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    if (screen !== 'playing') return null;

    const now = Date.now();
    const visibleMessages = isOpen
        ? messages
        : messages.filter((m) => now - m.time < FADE_TIME).slice(-5);

    return (
        <div
            className={`chat-container ${isOpen ? 'chat-open' : 'chat-closed'}`}
            onPointerDown={(e) => {
                if (isOpen) e.stopPropagation();
            }}
            onClick={(e) => {
                if (isOpen) e.stopPropagation();
            }}
        >
            <div className="chat-messages" ref={scrollRef}>
                {visibleMessages.map((msg, i) => (
                    <div
                        key={i}
                        className={`chat-msg chat-${msg.type}`}
                        style={{
                            opacity: isOpen ? 1 : Math.max(0, 1 - (now - msg.time) / FADE_TIME),
                        }}
                    >
                        {msg.text}
                    </div>
                ))}
            </div>

            {isOpen && (
                <form onSubmit={handleSubmit} className="chat-input-form">
                    <input
                        ref={inputRef}
                        className="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Wpisz komendę lub wiadomość..."
                        autoComplete="off"
                        spellCheck={false}
                    />
                </form>
            )}
        </div>
    );
};

export default ChatBox;
