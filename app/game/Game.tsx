'use client';
import { useEffect, useRef, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  World,
  DT,
  W,
  H,
  COLS,
  CELL,
  WEAPONS,
  POWER_WEAPONS,
  placementAdvice,
  SPECIALS,
  BOT_LEVELS,
  isBotLevel,
  type BotLevel,
  blankInput,
  awards,
  type Snapshot,
  type Input,
  type Player,
} from './engine';
import { Renderer } from './render';
import { NetView } from './net-view';
import { isTerrainId, type TerrainId } from './terrains';
import { TerrainPicker } from './TerrainPicker';
const names = [
  'Toi',
  'Barbe-Boum',
  'La Teigne',
  'Capitaine Plouf',
  'Billy Boulet',
  'Croche-Pied',
];
type Lobby = {
  map: TerrainId;
  botLevel: BotLevel;
  code: string;
  title: string;
  host: string;
  protected: boolean;
  capacity: number;
  players: { id: string; name: string; color: string }[];
  totals: Record<string, { wins: number; kills: number; damage: number }>;
};
type ActiveRoom = {
  code: string;
  title: string;
  protected: boolean;
  state: 'lobby' | 'play' | 'results';
  capacity: number;
  players: { id: string; name: string; color: string }[];
  updatedAt: number;
};
type ChatMessage = {
  id: string;
  player: string;
  color: string;
  text: string;
  at: number;
};
export default function Game() {
  const [map, setMap] = useState<TerrainId>('pirate');
  const [botLevel, setBotLevel] = useState<BotLevel>('normal');
  const botLabels = { easy: 'Facile', normal: 'Normal', hard: 'Difficile', expert: 'Expert' };
  const net = useRef<NetView | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<{
      world: World | null;
      renderer: Renderer | null;
      snap: Snapshot | null;
      mask: Uint8Array;
      socket: WebSocket | null;
      id: string;
      input: Input;
      charge: number;
      down: number;
      mode: string;
      overview: boolean;
      lastSeq: number;
    }>({
      world: null,
      renderer: null,
      snap: null,
      mask: new Uint8Array(),
      socket: null,
      id: 'local',
      input: blankInput(),
      charge: 0,
      down: 0,
      mode: 'menu',
      overview: false,
      lastSeq: 0,
    });
  const [mode, setMode] = useState('menu'),
    [screen, setScreen] = useState(''),
    [name, setName] = useState('Capitaine'),
    [specials, setSpecials] = useState([4, 8]),
    [snap, setSnap] = useState<Snapshot | null>(null),
    [lobby, setLobby] = useState<Lobby | null>(null),
    [error, setError] = useState(''),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [roomsBusy, setRoomsBusy] = useState(false),
    [toast, setToast] = useState(''),
    [muted, setMuted] = useState(false),
    [shake, setShake] = useState(0.5),
    [roomTitle, setRoomTitle] = useState(''),
    [roomPassword, setRoomPassword] = useState(''),
    [joinPassword, setJoinPassword] = useState(''),
    [rooms, setRooms] = useState<ActiveRoom[]>([]),
    [chatInput, setChatInput] = useState(''),
    [chatMessages, setChatMessages] = useState<ChatMessage[]>([]),
    [binding, setBinding] = useState(''),
    [keys, setKeys] = useState({ left: 'KeyA', right: 'KeyD', jump: 'Space' }),
    [server, setServer] = useState(process.env.NEXT_PUBLIC_GAME_SERVER || ''),
    [totals, setTotals] = useState<
      Record<string, { wins: number; kills: number; damage: number }>
    >({});
  const nameRef = useRef(name),
    specialRef = useRef(specials),
    keysRef = useRef(keys),
    mutedRef = useRef(muted),
    bindingRef = useRef(binding),
    screenRef = useRef(screen),
    audio = useRef<AudioContext | null>(null),
    lastTotals = useRef(-1),
    lobbyRef = useRef<Lobby | null>(null),
    serverRef = useRef(''),
    closeIntent = useRef(false),
    connection = useRef<() => void>(() => {});
  useEffect(() => {
    nameRef.current = name;
    specialRef.current = specials;
    keysRef.current = keys;
    mutedRef.current = muted;
    bindingRef.current = binding;
    screenRef.current = screen;
    lobbyRef.current = lobby;
    serverRef.current = server;
    if (runtime.current.renderer) runtime.current.renderer.shakeAmount = shake;
  }, [name, specials, keys, muted, binding, screen, lobby, server, shake]);
  const pad = useRef({ left: false, right: false });
  function padHold(e: React.PointerEvent<HTMLButtonElement>, on: boolean) {
    const side = e.currentTarget.dataset.pad;
    if (on) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (side === 'jump') runtime.current.input.jump = on;
    else if (side === 'left' || side === 'right') {
      pad.current[side] = on;
      runtime.current.input.move =
        (pad.current.right ? 1 : 0) - (pad.current.left ? 1 : 0);
    }
  }
  function toggleEquipment(value: number, randomIndex = 0) {
    const old = specialRef.current;
    const index = value === -1
      ? old.map((w, i) => w === -1 ? i : -1).filter((i) => i >= 0)[randomIndex] ?? -1
      : old.indexOf(value);
    const next = index >= 0
      ? old.filter((_, i) => i !== index)
      : [...old.slice(-1), value];
    specialRef.current = next;
    setSpecials(next);
    const socket = runtime.current.socket;
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify({ type: 'loadout', specials: next }));
  }
  const equipmentSlots = (
    <div className="specials" role="group" aria-label="Équipements de départ">
      {SPECIALS.map((w) => (
        <button key={w} type="button" className={specials.includes(w) ? 'chosen' : ''}
          aria-pressed={specials.includes(w)} title={WEAPONS[w].desc}
          onClick={() => toggleEquipment(w)}>
          {WEAPONS[w].icon} {WEAPONS[w].name}
        </button>
      ))}
      {[0, 1].map((index) => (
        <button key={'random-' + index} type="button"
          className={specials.filter((w) => w === -1).length > index ? 'chosen' : ''}
          aria-pressed={specials.filter((w) => w === -1).length > index}
          aria-label={'Équipement aléatoire ' + (index + 1)} title="Équipement aléatoire"
          onClick={() => toggleEquipment(-1, index)}>
          ? Aléatoire {index + 1}
        </button>
      ))}
    </div>
  );
  function changeMode(m: string) {
    runtime.current.mode = m;
    setMode(m);
  }
  function notify(t: string) {
    setToast(t);
    setTimeout(() => setToast(''), 3500);
  }
  function sound(type: string) {
    if (mutedRef.current) return;
    try {
      const a = audio.current ?? (audio.current = new AudioContext());
      if (a.state === 'suspended') a.resume();
      const osc = a.createOscillator(),
        g = a.createGain();
      osc.type = type === 'fire' ? 'square' : 'sawtooth';
      osc.frequency.setValueAtTime(type === 'fire' ? 220 : 95, a.currentTime);
      osc.frequency.exponentialRampToValueAtTime(25, a.currentTime + 0.22);
      g.gain.setValueAtTime(0.045, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.25);
      osc.connect(g);
      g.connect(a.destination);
      osc.start();
      osc.stop(a.currentTime + 0.26);
    } catch {}
  }
  function solo(training = false) {
    const r = runtime.current;
    closeIntent.current = true;
    r.socket?.close();
    r.socket = null;
    r.id = 'local';
    r.world = new World(Date.now() % 100000, training, map);
    r.world.botLevel = botLevel;
    r.world.addPlayer('local', nameRef.current, false, specialRef.current);
    for (let i = 1; i < (training ? 2 : 4); i++)
      r.world.addPlayer('bot' + i, names[i], true, [4, 8]);
    if (training) {
      const target = r.world.players[1];
      target.x = 700;
      target.y = r.world.surface(700) - 25;
    }
    r.mask = r.world.terrain;
    r.snap = r.world.snapshot();
    r.input = blankInput();
    r.input.tx = r.world.players[0].x + 240;
    r.input.ty = r.world.players[0].y - 140;
    r.lastSeq = 0;
    r.renderer?.reset();
    lastTotals.current = -1;
    setSnap(r.snap);
    setLobby(null);
    setScreen('');
    changeMode('play');
    if (!localStorage.getItem('grabuge-tutorial')) {
      notify('A/Q D : bouger · Espace : sauter · Molette : changer d’arme · Clic : tirer');
      localStorage.setItem('grabuge-tutorial', '1');
    }
  }
  function quit() {
    closeIntent.current = true;
    runtime.current.socket?.close();
    runtime.current.socket = null;
    runtime.current.world = null;
    setLobby(null);
    setScreen('');
    history.replaceState(null, '', location.pathname);
    changeMode('menu');
    runtime.current.renderer?.reset();
  }
  async function connect(join = false, requestedCode = code) {
    setError('');
    setBusy(true);
    closeIntent.current = false;
    try {
      let base =
        serverRef.current.trim() ||
        (process.env.NODE_ENV==='development' && ['localhost', '127.0.0.1'].includes(location.hostname)
          ? 'http://127.0.0.1:8788'
          : location.origin);
      new URL(base);
      if (!/^https?:\/\//.test(base))
        throw Error('Adresse du serveur invalide');
      if (!join) {
        const res = await fetch(base + '/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: roomTitle.trim(),
            password: roomPassword.trim(),
          }),
        });
        if (!res.ok)
          throw Error(
            'Le serveur de salons est indisponible. Le mode solo reste accessible.',
          );
        const data = (await res.json()) as { code: string };
        setCode(data.code);
        await openSocket(base, data.code, roomPassword.trim());
      } else {
        if (!/^[A-Z0-9]{6}$/.test(requestedCode.toUpperCase()))
          throw Error('Le code comporte 6 lettres ou chiffres.');
        await openSocket(base, requestedCode.toUpperCase(), joinPassword.trim());
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function refreshRooms() {
    setRoomsBusy(true);
    try {
      const base =
        serverRef.current.trim() ||
        (process.env.NODE_ENV==='development' && ['localhost', '127.0.0.1'].includes(location.hostname)
          ? 'http://127.0.0.1:8788'
          : location.origin);
      const res = await fetch(base + '/api/rooms');
      if (!res.ok) throw Error('Liste des salons indisponible.');
      const data = (await res.json()) as { rooms: ActiveRoom[] };
      setRooms(data.rooms);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRoomsBusy(false);
    }
  }
  async function openSocket(base: string, room: string, password = '') {
    const r = runtime.current;
    const key = 'grabuge-token-' + room;
    const token = sessionStorage.getItem(key) || crypto.randomUUID();
    sessionStorage.setItem(key, token);
    const url = new URL('/api/rooms/' + room, base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('token', token);
    url.searchParams.set('name', nameRef.current);
    url.searchParams.set('specials', specialRef.current.join(','));
    if (password) url.searchParams.set('password', password);
    const ws = new WebSocket(url);
    r.socket = ws;
    r.world = null;
    let welcomed = false;
    const timeout = setTimeout(() => {
      if (!welcomed) {
        ws.close();
        setError(
          'Connexion impossible au salon. Vérifie son code et le serveur.',
        );
        setBusy(false);
      }
    }, 8000);
    connection.current = () => {
      void openSocket(base, room);
    };
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'error') {
        setError(data.message);
        setBusy(false);
        return;
      }
      if (data.type === 'welcome') {
        welcomed = true;
        clearTimeout(timeout);
        r.id = data.id;
        r.input = blankInput();
        r.lastSeq = 0;
        setBusy(false);
        setScreen('');
        setChatMessages([]);
        changeMode('lobby');
        setCode(room);
        const u = new URL(location.href);
        u.searchParams.set('room', room);
        history.replaceState(null, '', u);
      }
      if (data.type === 'lobby') {
        setLobby(data.lobby);
        setTotals(data.lobby.totals);
        if (data.state === 'lobby') changeMode('lobby');
      }
      if (data.type === 'chat') {
        setChatMessages((old) => [...old.slice(-29), data.message]);
      }
      if (data.type === 'state') {
        const s = data.snapshot as Snapshot;
        if (s.terrain) {
          r.mask = new Uint8Array(s.terrain);
          r.renderer?.reset();
          r.snap = null;
        }
        if (!r.mask.length) return;
        const previous = r.snap;
        const events = previous?.seed === s.seed ? [...previous.events] : [];
        for (const e of s.events) {
          if (events.some((old) => old.seq === e.seq)) continue;
          if (e.seq !== events.length + 1 && !s.terrain) {
            ws.send(JSON.stringify({ type: 'sync' }));
            return;
          }
          events.push(e);
          if (!s.terrain) {
            for (
              let yy = Math.max(0, Math.floor((e.y - e.r) / CELL));
              yy < Math.min(H / CELL, Math.ceil((e.y + e.r) / CELL));
              yy++
            )
              for (
                let xx = Math.max(0, Math.floor((e.x - e.r) / CELL));
                xx < Math.min(COLS, Math.ceil((e.x + e.r) / CELL));
                xx++
              )
                if ((xx * CELL - e.x) ** 2 + (yy * CELL - e.y) ** 2 <= e.r ** 2)
                  r.mask[yy * COLS + xx] = e.fill ? 1 : 0;
          }
        }
        s.events = events;
        if (!r.input.tx && !r.input.ty) {
          const local = s.players.find((p) => p.id === r.id);
          if (local) {
            r.input.tx = local.x + 240;
            r.input.ty = local.y - 140;
          }
        }
        r.snap = s;
        net.current?.accept(s, r.mask, r.id);
        if (s.done) {
          changeMode('results');
          setSnap(s);
        } else if (r.mode !== 'play') {
          changeMode('play');
          setScreen('');
          r.renderer?.reset();
        }
      }
    };
    ws.onerror = () => {
      setError('Le serveur de salons ne répond pas.');
      setBusy(false);
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      setBusy(false);
      if (!closeIntent.current && welcomed) {
        notify('Connexion perdue. Tentative de reconnexion…');
        setTimeout(() => {
          if (!closeIntent.current) connection.current();
        }, 1500);
      }
    };
  }
  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    runtime.current.socket?.send(JSON.stringify({ type: 'chat', text }));
    setChatInput('');
  }
  useEffect(() => {
    const stored = localStorage.getItem('grabuge-settings');
    if (stored)
      try {
        const s = JSON.parse(stored);
        setName(s.name || 'Capitaine');
        setMuted(!!s.muted);
        setShake(s.shake ?? 0.5);
        if (s.keys) setKeys(s.keys);
        if (s.server) setServer(s.server);
        if (Array.isArray(s.specials)) {
          const slots = s.specials.filter((w: unknown) => typeof w === 'number' && (w === -1 || SPECIALS.includes(w))).slice(0, 2);
          setSpecials(slots);
        }
        if (isBotLevel(s.botLevel)) setBotLevel(s.botLevel);
        if (isTerrainId(s.map)) setMap(s.map);
      } catch {}
    const room = new URLSearchParams(location.search).get('room');
    if (room) {
      setCode(room);
      setScreen('network');
    }
    net.current = new NetView();
    const r = runtime.current,
      renderer = new Renderer(canvas.current!);
    r.renderer = renderer;
    renderer.onSound = sound;
    const demo = new World(88);
    demo.addPlayer('demo', '', true);
    demo.players[0].x = 1250;
    demo.players[0].y = demo.surface(1250) - 25;
    demo.addPlayer('demo2', '', true);
    demo.players[1].x = 1500;
    demo.players[1].y = demo.surface(1500) - 25;
    const demoSnap = demo.snapshot();
    const held = new Set<string>();
    let lastWeaponWheel = 0;
    let raf = 0,
      last = performance.now(),
      acc = 0,
      send = 0,
      ui = 0;
    let mouseX = 0,
      mouseY = 0,
      pointerSeen = false;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const playing = r.mode === 'play';
      if (playing && pointerSeen) {
        const local = r.snap?.players.find((p) => p.id === r.id);
        if (local) {
          const pos = renderer.screenToWorld(mouseX, mouseY);
          r.input.tx = Math.max(0, Math.min(W, pos.x));
          r.input.ty = Math.max(0, Math.min(H, pos.y));
          r.input.angle = Math.atan2(pos.y - local.y, pos.x - local.x);
        }
      }
      if (playing && r.down) {
        const cycle = ((now - r.down) / 1100) % 2;
        r.charge = cycle <= 1 ? cycle : 2 - cycle;
      }
      if (playing) {
        if (r.world) {
          acc += dt;
          while (acc >= DT) {
            r.input.seq++;
            r.world.command(r.id, r.input);
            r.input.fire = false;
            r.input.action = false;
            r.world.step();
            acc -= DT;
          }
          r.snap = r.world.snapshot();
          r.mask = r.world.terrain;
          if (r.world.done) {
            changeMode('results');
            setSnap(r.snap);
            if (lastTotals.current !== r.world.seed) {
              lastTotals.current = r.world.seed;
              setTotals((old) => {
                const next = { ...old };
                for (const p of r.world!.players) {
                  const a = next[p.name] ?? { wins: 0, kills: 0, damage: 0 };
                  next[p.name] = {
                    wins: a.wins + (p.id === r.world!.winner ? 1 : 0),
                    kills: a.kills + p.stats.kills,
                    damage: a.damage + p.stats.damage,
                  };
                }
                return next;
              });
            }
          }
        } else {
          send += dt;
          if (send >= DT && r.socket?.readyState === 1) {
            r.input.seq++;
            r.socket.send(JSON.stringify({ type: 'input', input: r.input }));
            net.current?.sent(r.input);
            r.input.fire = false;
            r.input.action = false;
            send = 0;
          }
        }
        ui += dt;
        if (ui > 0.1) {
          setSnap(r.snap ? { ...r.snap } : null);
          ui = 0;
        }
      }
      if (r.snap && r.mode !== 'menu' && r.mode !== 'lobby') {
        const view =
          !r.world && net.current
            ? net.current.render(r.snap, dt)
            : structuredClone(r.snap);
        const local = view.players.find((p) => p.id === r.id);
        if (local) {
          local.angle = r.input.angle;
          local.input.tx = r.input.tx;
          local.input.ty = r.input.ty;
          local.weapon = r.input.weapon;
        }
        renderer.draw(view, r.mask, r.id, dt, false, r.overview, r.charge);
      } else renderer.draw(demoSnap, demo.terrain, 'demo', dt, true);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const keydown = (e: KeyboardEvent) => {
      if (bindingRef.current) {
        if (e.code !== 'Escape') {
          setKeys((old) => ({ ...old, [bindingRef.current]: e.code }));
          setBinding('');
          e.preventDefault();
        }
        return;
      }
      if ((e.target as HTMLElement)?.matches('input,select,textarea')) return;
      if (r.mode !== 'play') return;
      if (e.code === 'Escape') {
        if (r.down) {
          r.down = 0;
          r.charge = 0;
        } else setScreen((s) => (s ? '' : 'settings'));
        return;
      }
      if (screenRef.current) return;
      if (['Space', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.code))
        e.preventDefault();
      held.add(e.code);
      r.input.move =
        (held.has(keysRef.current.right) || held.has('ArrowRight') ? 1 : 0) -
        (held.has(keysRef.current.left) ||
        held.has('KeyQ') ||
        held.has('ArrowLeft')
          ? 1
          : 0);
      r.input.jump = held.has(keysRef.current.jump);
      if (e.code === 'Tab') r.overview = true;
      if (e.code === 'KeyE') r.input.action = true;
      if (e.code === 'KeyF') {
        r.input.fuse = (r.input.fuse % 4) + 1;
        notify('Retardement : ' + r.input.fuse + ' s');
      }
      if (/^Digit[1-9]$/.test(e.code)) {
        const p = r.snap?.players.find((p) => p.id === r.id);
        const available = WEAPONS.map((_, i) => i).filter(
          (i) => p && p.ammo[i] !== 0,
        );
        const w = available[Number(e.code.slice(-1)) - 1];
        if (w !== undefined) r.input.weapon = w;
      }
    };
    const keyup = (e: KeyboardEvent) => {
      held.delete(e.code);
      r.input.move =
        (held.has(keysRef.current.right) || held.has('ArrowRight') ? 1 : 0) -
        (held.has(keysRef.current.left) ||
        held.has('KeyQ') ||
        held.has('ArrowLeft')
          ? 1
          : 0);
      r.input.jump = held.has(keysRef.current.jump);
      if (e.code === 'Tab') r.overview = false;
    };
    const move = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.('.touch-pad')) return;
      if (e.target !== canvas.current && !r.down) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
      pointerSeen = true;
      const p = r.snap?.players.find((p) => p.id === r.id);
      if (!p) return;
      const pos = renderer.screenToWorld(e.clientX, e.clientY);
      r.input.tx = Math.max(0, Math.min(W, pos.x));
      r.input.ty = Math.max(0, Math.min(H, pos.y));
      r.input.angle = Math.atan2(pos.y - p.y, pos.x - p.x);
    };
    const down = (e: PointerEvent) => {
      if (r.mode !== 'play' || screenRef.current || e.target !== canvas.current)
        return;
      if (e.button === 2) {
        r.down = 0;
        r.charge = 0;
        return;
      }
      if (e.button !== 0) return;
      try {
        const a = audio.current ?? (audio.current = new AudioContext());
        if (a.state === 'suspended') void a.resume();
      } catch {}
      move(e);
      if (!POWER_WEAPONS.includes(r.input.weapon)) {
        r.input.fire = true;
        r.down = 0;
        r.charge = 0;
        return;
      }
      if (r.down) {
        r.input.power = Math.max(0.15, r.charge);
        r.input.fire = true;
        r.down = 0;
        r.charge = 0;
      } else {
        r.down = performance.now();
        r.charge = 0;
      }
    };
    const blur = () => {
      held.clear();
      r.input.move = 0;
      r.input.jump = false;
      r.down = 0;
      r.charge = 0;
    };
    const wheel = (e: WheelEvent) => {
      if (r.mode !== 'play' || screenRef.current) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        renderer.targetZoom = Math.max(
          0.7,
          Math.min(1.7, renderer.targetZoom - e.deltaY * 0.001),
        );
        return;
      }
      if (Math.abs(e.deltaY) < 1 || performance.now() - lastWeaponWheel < 120)
        return;
      const player = r.snap?.players.find((p) => p.id === r.id && p.alive);
      const weapons = WEAPONS.map((_, i) => i).filter(
        (i) => player && player.ammo[i] !== 0,
      );
      if (!weapons.length) return;
      const current = Math.max(0, weapons.indexOf(r.input.weapon));
      const direction = e.deltaY > 0 ? 1 : -1;
      r.input.weapon = weapons[(current + direction + weapons.length) % weapons.length];
      r.down = 0;
      r.charge = 0;
      lastWeaponWheel = performance.now();
      if (r.snap) setSnap({ ...r.snap });
    };
    const context = (e: MouseEvent) => {
      if (e.target === canvas.current) e.preventDefault();
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerdown', down);
    window.addEventListener('blur', blur);
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('contextmenu', context);
    return () => {
      cancelAnimationFrame(raf);
      closeIntent.current = true;
      r.socket?.close();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('blur', blur);
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('contextmenu', context);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem(
      'grabuge-settings',
      JSON.stringify({ name, muted, shake, keys, server, specials, botLevel, map }),
    );
  }, [name, muted, shake, keys, server, specials, botLevel, map]);
  useEffect(() => {
    if (screen === 'network') void refreshRooms();
  }, [screen]);
  const p = snap?.players.find((p) => p.id === runtime.current.id),
    weapon = WEAPONS[runtime.current.input.weapon],
    available = WEAPONS.map((_, i) => i).filter((i) => p && p.ammo[i] !== 0);
  const placement = p&&[9,11,14].includes(runtime.current.input.weapon)?placementAdvice(p,runtime.current.input.weapon,runtime.current.input.tx,runtime.current.input.ty,snap?.players||[],snap?.water||890,(x,y)=>x<0||x>=W||y>=H||y>=0&&!!runtime.current.mask[Math.floor(y/CELL)*COLS+Math.floor(x/CELL)]||(snap?.foams||[]).some(f=>Math.hypot(x-f.x,y-f.y)<f.r)):null;
  const fmt = (v: number) => Math.round(v).toLocaleString('fr-FR');
  const rankedPlayers = snap
    ? [...snap.players].sort((a, b) =>
        Number(b.id === snap.winner) - Number(a.id === snap.winner) ||
        b.stats.kills - a.stats.kills ||
        b.stats.damage - a.stats.damage ||
        b.stats.survival - a.stats.survival,
      )
    : [];
  const playerQuip = (q: Player) => {
    const accuracy = q.stats.shots ? q.stats.hits / q.stats.shots : 0;
    if (q.id === snap?.winner)
      return q.hp < 10
        ? `Encore debout avec ${Math.ceil(q.hp)} PV. Même la mort a raté son tir.`
        : 'Le pont, le butin et les droits de vantardise sont à lui.';
    if (q.stats.self > 20) return 'Son adversaire le plus dangereux était lui-même.';
    if (q.stats.water > 0) return `A organisé ${q.stats.water} baignade${q.stats.water > 1 ? 's' : ''} non consentie${q.stats.water > 1 ? 's' : ''}.`;
    if (q.stats.shots === 0) return 'Pacifiste, ou simplement très occupé à survivre.';
    if (accuracy >= 0.6) return 'Un compas dans l’œil et très peu de remords.';
    if (q.stats.crates > 0) return 'A surtout suivi l’odeur du butin.';
    return 'A semé du grabuge. La précision viendra avec la revanche.';
  };
  const rematch = () => {
    if (runtime.current.socket)
      runtime.current.socket.send(JSON.stringify({ type: 'start' }));
    else solo(false);
  };
  return (
    <main className={"game-shell "+(mode==='play'?'is-playing':'')}>
      <canvas
        ref={canvas}
        className="scene"
        aria-label="Arène de combat pirate"
      />
      {mode === 'menu' && (
        <>
          <div className="shade" />
          <header className="mast">
            <span className="brand">☠ GRABUGE</span>
            <span className="pill">2 À 4 JOUEURS · ACTIONS SIMULTANÉES</span>
          </header>
          <section className="start">
            <div className="eyebrow">PIRATES EN PAGAILLE</div>
            <h1>GRABUGE !</h1>
            <h2>
              Pas de quartier.
              <br />
              Pas chacun son tour.
            </h2>
            <p>
              Un bout d’île. Un arsenal déraisonnable.
              <br />
              Et tes amis au fond de l’eau.
            </p>
            <div className="settings-line">
              <input
                aria-label="Ton nom de pirate"
                maxLength={18}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <span className="pill">☠ {specials.length}/2 équipements</span>
            </div>
            <TerrainPicker value={map} onChange={setMap} />
            {equipmentSlots}
            <label className="field"><span>Niveau des bots</span>
<select value={botLevel} onChange={(e) => { if (isBotLevel(e.target.value)) setBotLevel(e.target.value); }}>
{BOT_LEVELS.map((level) => <option key={level} value={level}>{botLabels[level]}</option>)}
</select></label>
            <div className="actions">
              <button className="primary" onClick={() => solo(false)}>
                ⚔ Jouer contre les bots
              </button>
              <button
                className="secondary"
                onClick={() => setScreen('network')}
              >
                Avec des amis ↗
              </button>
            </div>
            <div className="actions">
              <button className="menu-link" onClick={() => solo(true)}>
                Terrain d’entraînement
              </button>
              <button
                className="menu-link"
                onClick={() => setScreen('arsenal')}
              >
                Les {WEAPONS.length} équipements
              </button>
              <button
                className="menu-link"
                onClick={() => setScreen('settings')}
              >
                Réglages
              </button>
            </div>
          </section>
          <div className="footer-note">
            Armes à puissance : un clic pour armer, un second pour tirer.
          </div>
        </>
      )}
      {mode === 'play' && snap && (
        <>
          <div className="top-hud">
            <div className="crew">
              {snap.players.map((q) => (
                <div
                  key={q.id}
                  className={'crew-card ' + (!q.alive ? 'dead' : '')}
                  style={{ '--crew': q.color } as React.CSSProperties}
                >
                  <strong>{q.name}</strong>
                  {q.alive ? Math.ceil(q.hp) + ' PV' : '☠ À la mer'} ·{' '}
                  {q.stats.kills} ⚔
                </div>
              ))}
            </div>
            <div className="hud-right">
              <div className="clock">
                {Math.floor(snap.time / 60)}:
                {String(Math.floor(snap.time % 60)).padStart(2, '0')}
                <small>
                  {snap.training
                    ? 'ENTRAÎNEMENT'
                    : snap.time > 120
                      ? 'LA MARÉE MONTE'
                      : 'MARÉE À 2:00'}
                </small>
              </div>
              <button
                className="secondary small"
                onClick={() => setScreen('settings')}
              >
                ☰
              </button>
            </div>
          </div>
          {p?.alive && (
            <div className="aim-help">
              {p.pilot ? (
                <>
                  <strong>🐦 TU PILOTES LE PIGEON</strong>
                  <span>
                    Déplace la souris : il suit le viseur. <b>E</b> : reprendre
                    le pirate.
                  </span>
                </>
              ) : p.rope ? (
                <>
                  <strong>⚓ GRAPPIN ACCROCHÉ</strong>
                  <span>Gauche / droite : se balancer · E : lâcher</span>
                </>
              ) : p.jet > 0 ? (
                <>
                  <strong>🔥 JETPACK · {p.jet.toFixed(1)} s</strong>
                  <span>Gauche / droite : diriger · E : couper la poussée</span>
                </>
              ) : placement ? (<><strong style={{color:placement.ok?'#a3ffb9':'#ffad96'}}>{weapon.name} · {p.cd>0?'RÉCUPÉRATION':placement.ok?'EMPLACEMENT VALIDE':'PLACEMENT IMPOSSIBLE'}</strong><span>{p.cd>0?'Action effectuée · prêt dans '+p.cd.toFixed(1)+' s':placement.text}</span></>) : POWER_WEAPONS.includes(runtime.current.input.weapon) ? (
                <>
                  <strong>
                    {runtime.current.down
                      ? 'PUISSANCE ' +
                        Math.round(
                          Math.max(0.15, runtime.current.charge) * 100,
                        ) +
                        ' %'
                      : 'CLIQUE POUR ARMER, RECLIQUE POUR TIRER'}
                  </strong>
                  <div className="power-track">
                    <i
                      style={{
                        width:
                          Math.max(0.15, runtime.current.charge) * 100 + '%',
                      }}
                    />
                  </div>
                  <span>
                    La jauge monte et redescend · Clique pour tirer · Clic
                    droit pour annuler · Pointillés : trajectoire jusqu’au
                    premier contact
                  </span>
                </>
              ) : (
                <>
                  <strong>{weapon.name}</strong>
                  <span>{weapon.desc}</span>
                </>
              )}
            </div>
          )}
          {p?.alive && !screen && (
            <>
              <div className="touch-pad touch-left">
                <button
                  aria-label="Aller à gauche"
                  data-pad="left"
                  onPointerDown={(e) => padHold(e, true)}
                  onPointerUp={(e) => padHold(e, false)}
                  onPointerCancel={(e) => padHold(e, false)}
                  onLostPointerCapture={(e) => padHold(e, false)}
                >
                  ◀
                </button>
                <button
                  aria-label="Aller à droite"
                  data-pad="right"
                  onPointerDown={(e) => padHold(e, true)}
                  onPointerUp={(e) => padHold(e, false)}
                  onPointerCancel={(e) => padHold(e, false)}
                  onLostPointerCapture={(e) => padHold(e, false)}
                >
                  ▶
                </button>
              </div>
              <div className="touch-pad touch-right">
                <button
                  aria-label="Sauter"
                  data-pad="jump"
                  onPointerDown={(e) => padHold(e, true)}
                  onPointerUp={(e) => padHold(e, false)}
                  onPointerCancel={(e) => padHold(e, false)}
                  onLostPointerCapture={(e) => padHold(e, false)}
                >
                  ▲
                </button>
              </div>
            </>
          )}
          <div className="hint">
            {p?.alive
              ? 'A/Q D déplacer · Espace sauter · Molette changer d’arme · Clic tirer · E lâcher · F minuterie · Tab vue d’ensemble'
              : '☠ Tu es éliminé · Observe les survivants'}
          </div>
          {p?.alive && (
            <div className="dock">
              <div className="weapons">
                {available.map((w, i) => (
                  <button
                    key={w}
                    className={
                      'weapon ' +
                      (runtime.current.input.weapon === w ? 'selected' : '')
                    }
                    title={WEAPONS[w].name + ' — ' + WEAPONS[w].desc}
                    onClick={() => {
                      runtime.current.input.weapon = w;
                      setSnap({ ...snap });
                    }}
                  >
                    <small>{i < 9 ? i + 1 : ''}</small>
                    {WEAPONS[w].icon}
                    <em>{p.ammo[w] < 0 ? '∞' : p.ammo[w]}</em>
                  </button>
                ))}
              </div>
              <div className="weapon-info">
                <strong>{weapon.name}</strong>
                <span>
                  {p.cd > 0
                    ? 'Prêt dans ' + p.cd.toFixed(1) + ' s'
                    : 'PRÊT À TIRER'}{' '}
                  {runtime.current.input.weapon === 1
                    ? '· ' + runtime.current.input.fuse + ' s'
                    : ''}
                </span>
              </div>
              <div className="recovery">
                <i
                  style={{
                    width:
                      (p.cd > 0 ? Math.max(0, 1 - p.cd / 8) * 100 : 100) + '%',
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}
      {mode === 'lobby' && lobby && (
        <section className="panel center-panel">
          <div className="eyebrow">L’ÉQUIPAGE SE RASSEMBLE</div>
          <h2>{lobby.title || 'Salon'} · {lobby.code}</h2>
          <p>
            Les places libres seront occupées par des bots. Une manche, puis la
            revanche.
            {lobby.protected ? ' Salon protégé.' : ''}
          </p>
          <div className="lobby-list">
            {lobby.players.map((q) => (
              <div
                className="lobby-person"
                style={{ '--crew': q.color } as React.CSSProperties}
                key={q.id}
              >
                ☠ {q.name}
                {q.id === lobby.host ? ' · capitaine' : ''}
              </div>
            ))}
          </div>
          <div className="settings-line">
            <span className="pill">☠ {specials.length}/2 équipements</span>
          </div>
          <TerrainPicker value={lobby.map || 'pirate'} disabled={lobby.host !== runtime.current.id}
            onChange={(map) => runtime.current.socket?.send(JSON.stringify({ type: 'terrain', map }))} />
          {equipmentSlots}
          <label className="field"><span>Niveau des bots</span>
<select value={lobby.botLevel || 'normal'} disabled={lobby.host !== runtime.current.id}
onChange={(e) => runtime.current.socket?.send(JSON.stringify({ type: 'botLevel', level: e.target.value }))}>
{BOT_LEVELS.map((level) => <option key={level} value={level}>{botLabels[level]}</option>)}
</select></label>
          <div className="lobby-chat">
            <h3>Chat du salon</h3>
            <div className="chat-log" aria-live="polite">
              {chatMessages.length ? (
                chatMessages.map((m) => (
                  <p key={m.id}>
                    <strong style={{ color: m.color }}>{m.player}</strong>{' '}
                    {m.text}
                  </p>
                ))
              ) : (
                <p className="muted">Aucun message pour le moment.</p>
              )}
            </div>
            <div className="settings-line">
              <input
                aria-label="Message de chat"
                placeholder="Message"
                value={chatInput}
                maxLength={180}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendChat();
                }}
              />
              <button className="secondary" onClick={sendChat}>
                Envoyer
              </button>
            </div>
          </div>
          <div className="actions">
            <button
              className="primary"
              disabled={lobby.host !== runtime.current.id}
              onClick={() =>
                runtime.current.socket?.send(JSON.stringify({ type: 'start' }))
              }
            >
              Lancer la bataille
            </button>
            <button
              className="secondary"
              onClick={() => {
                navigator.clipboard
                  .writeText(location.href)
                  .then(() => notify('Lien du salon copié !'))
                  .catch(() => notify('Code du salon : ' + lobby.code));
              }}
            >
              Copier l’invitation
            </button>
            <button className="secondary" onClick={quit}>
              Quitter
            </button>
          </div>
          {lobby.host !== runtime.current.id && (
            <p>Le capitaine lance la manche.</p>
          )}
        </section>
      )}
      {mode === 'results' && snap && (
        <section className="panel center-panel results-panel">
          <div className="eyebrow">LES COMPTES SONT RÉGLÉS</div>
          <h2 className="results-title">
            {snap.winner
              ? '🏴‍☠️ ' +
                snap.players.find((q) => q.id === snap.winner)?.name +
                ' prend le large !'
              : 'Tout le monde à l’eau !'}
          </h2>
          <div className="actions">
            <button
              className="primary"
              disabled={!!lobby && lobby.host !== runtime.current.id}
              onClick={rematch}
            >
              ⚔ Revanche !
            </button>
            <button className="secondary" onClick={quit}>
              Retour au port
            </button>
          </div>
          <div className="result-ranking">
            {rankedPlayers.map((q, index) => {
              const accuracy = q.stats.shots
                ? Math.round((q.stats.hits / q.stats.shots) * 100) + ' %'
                : 'Aucun tir';
              return (
                <article
                  className={'result-player ' + (q.id === snap.winner ? 'winner' : '')}
                  style={{ '--crew': q.color } as React.CSSProperties}
                  key={q.id}
                >
                  <div className="result-player-head">
                    <span className="result-rank">{['🏆', '🥈', '🥉', '☠'][index] || '☠'}</span>
                    <div>
                      <strong>{q.name}</strong>
                      <span>{q.id === snap.winner ? `${Math.ceil(q.hp)} PV restants` : `À la mer après ${Math.floor(q.stats.survival)} s`}</span>
                    </div>
                  </div>
                  <div className="result-score">
                    <div><b>{q.stats.kills}</b><span>élimination{q.stats.kills > 1 ? 's' : ''}</span></div>
                    <div><b>{fmt(q.stats.damage)}</b><span>dégâts infligés</span></div>
                    <div><b>{accuracy}</b><span>précision</span></div>
                  </div>
                  <p className="result-quip">{playerQuip(q)}</p>
                </article>
              );
            })}
          </div>
          <h3>Les faits d’armes</h3>
          <div className="award-grid">
            {awards(snap.players, snap.winner).map((a) => (
              <div className="award" key={a.title}>
                <b>✦ {a.title}</b>
                <span>{a.names} · {a.value}</span>
              </div>
            ))}
          </div>
          <details className="result-details">
            <summary>Le rapport confidentiel du capitaine</summary>
            <div className="result-details-list">
              {rankedPlayers.map((q) => (
                <div className="result-detail-row" key={q.id}>
                  <strong style={{ color: q.color }}>{q.name}</strong>
                  <span>Reçus <b>{fmt(q.stats.taken)}</b></span>
                  <span>Sur lui-même <b>{fmt(q.stats.self)}</b></span>
                  <span>Terrain <b>{fmt(q.stats.terrain)} px²</b></span>
                  <span>Butins <b>{q.stats.crates}</b></span>
                  <span>Projection <b>{fmt(q.stats.projection)} px</b></span>
                  <span>Arme favorite <b>{Math.max(...q.stats.byWeapon) > 0 ? WEAPONS[q.stats.byWeapon.indexOf(Math.max(...q.stats.byWeapon))].name : 'Aucune'}</b></span>
                </div>
              ))}
            </div>
          </details>
          <h3>Bilan des revanches</h3>
          <div className="lobby-list">
            {Object.entries(totals).map(([id, t]) => (
              <div key={id} className="pill">
                {snap.players.find((q) => q.id === id)?.name || id} · {t.wins}{' '}
                victoire(s) · {t.kills} ☠ · {fmt(t.damage)} dégâts
              </div>
            ))}
          </div>
        </section>
      )}
      {screen && (
        <section className="panel center-panel">
          <button
            className="secondary small"
            style={{ float: 'right' }}
            onClick={() => setScreen('')}
          >
            Fermer ✕
          </button>
          {screen === 'network' && (
            <>
              <div className="eyebrow">À L’ABORDAGE, ENSEMBLE</div>
              <h2>Invite ton équipage</h2>
              <p>
                Crée un salon, rejoins celui d’un ami ou embarque dans un salon actif. Jusqu’à quatre
                pirates, sans compte.
              </p>
              <label className="field">
                <span>Ton pseudo</span>
                <input
                  aria-label="Ton nom de pirate"
                  placeholder="Ton nom de pirate"
                  maxLength={18}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <h3>Créer</h3>
              <div className="settings-line">
                <input
                  aria-label="Nom du salon"
                  placeholder="Nom du salon"
                  value={roomTitle}
                  maxLength={40}
                  onChange={(e) => setRoomTitle(e.target.value)}
                />
                <input
                  aria-label="Mot de passe du salon"
                  placeholder="Mot de passe optionnel"
                  type="password"
                  value={roomPassword}
                  maxLength={80}
                  onChange={(e) => setRoomPassword(e.target.value)}
                />
              </div>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => connect(false)}
                >
                  {busy ? 'Connexion…' : 'Créer un salon'}
                </button>
              </div>
              <h3>Rejoindre par code</h3>
              <div className="settings-line">
                <input
                  aria-label="Code du salon"
                  placeholder="CODE DU SALON"
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <input
                  aria-label="Mot de passe pour rejoindre"
                  placeholder="Mot de passe si protégé"
                  type="password"
                  value={joinPassword}
                  maxLength={80}
                  onChange={(e) => setJoinPassword(e.target.value)}
                />
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => connect(true)}
                >
                  Rejoindre
                </button>
              </div>
              <div className="settings-line">
                <h3>Salons actifs</h3>
                <button
                  className="secondary small"
                  disabled={roomsBusy}
                  onClick={refreshRooms}
                >
                  {roomsBusy ? 'Actualisation…' : 'Rafraîchir'}
                </button>
              </div>
              <div className="room-list">
                {rooms.length ? (
                  rooms.map((room) => (
                    <article className="room-card" key={room.code}>
                      <div>
                        <strong>
                          {room.title} · {room.code}
                        </strong>
                        <span>
                          {room.state === 'play'
                            ? 'En cours'
                            : room.state === 'results'
                              ? 'Résultats'
                              : 'En attente'}{' '}
                          · {room.players.length}/{room.capacity}
                          {room.protected ? ' · protégé' : ''}
                        </span>
                      </div>
                      <div className="room-players">
                        {room.players.map((player) => (
                          <span
                            key={player.id}
                            style={{ color: player.color }}
                          >
                            {player.name}
                          </span>
                        ))}
                      </div>
                      <button
                        className="secondary small"
                        disabled={busy}
                        onClick={() => {
                          setCode(room.code);
                          void connect(true, room.code);
                        }}
                      >
                        Rejoindre
                      </button>
                    </article>
                  ))
                ) : (
                  <p>Aucun salon actif.</p>
                )}
              </div>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
          {screen === 'arsenal' && (
            <>
              <h2>De quoi faire du grabuge</h2>
              <p>
                Une récupération commune après chaque attaque. Changer d’arme ne
                permet pas de tricher.
              </p>
              <div className="weapon-grid">
                {WEAPONS.map((w) => (
                  <article className="weapon-detail" key={w.name}>
                    <strong>
                      {w.icon} {w.name}
                    </strong>
                    <p>{w.desc}</p>
                    <span className="eyebrow">
                      {w.cd} S ·{' '}
                      {w.ammo < 0 ? 'ILLIMITÉ' : w.ammo + ' CHARGE(S)'}
                    </span>
                  </article>
                ))}
              </div>
            </>
          )}
          {screen === 'settings' && (
            <>
              <h2>À ta main</h2>
              <div className="settings-line">
                <label className="settings-line">
                  <Switch
                    aria-label="Activer le son"
                    checked={!muted}
                    onCheckedChange={(v) => setMuted(!v)}
                  />{' '}
                  Son
                </label>
                <label>
                  Secousses{' '}
                  <Slider
                    className="shake-slider"
                    aria-label="Intensité des secousses"
                    min={0}
                    max={1}
                    step={0.1}
                    value={[shake]}
                    onValueChange={(v) => setShake(Array.isArray(v) ? v[0] : v)}
                  />
                </label>
              </div>
              <h3>Commandes</h3>
              <div className="settings-line">
                {(['left', 'right', 'jump'] as const).map((key, i) => (
                  <button
                    key={key}
                    className="secondary small"
                    onClick={() => setBinding(key)}
                  >
                    {['Gauche', 'Droite', 'Saut'][i]} :{' '}
                    {binding === key
                      ? 'Appuie sur une touche…'
                      : keys[key].replace('Key', '')}
                  </button>
                ))}
              </div>
              <p>
                Les armes à puissance utilisent deux clics, les autres partent
                au premier · Clic droit : annuler · E : lâcher le grappin /
                arrêter le jetpack / décrocher une ventouse · F : retardement ·
                Tab : vue d’ensemble · Molette : changer d’arme · Ctrl + molette
                : zoom. Sur écran tactile, les flèches et le saut apparaissent en
                bas de l’arène.
              </p>
              <details>
                <summary>Connexion avancée</summary>
                <label className="field">
                  <span>Adresse du serveur de salons (vide = ce site)</span>
                  <input
                    style={{ width: '100%' }}
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    placeholder="https://serveur.example.workers.dev"
                  />
                </label>
              </details>
              {mode === 'play' && (
                <>
                  <p>La partie continue pendant les réglages.</p>
                  <button className="danger" onClick={quit}>
                    Quitter la partie
                  </button>
                </>
              )}
            </>
          )}
        </section>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
