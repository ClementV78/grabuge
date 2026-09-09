import { World, COLORS, DT, SPECIALS, isBotLevel, type BotLevel, type Input } from '../app/game/engine';
import { isTerrainId, type TerrainId } from '../app/game/terrains';
export type RoomSummary = {
  code: string;
  title: string;
  host: string;
  protected: boolean;
  state: 'lobby' | 'play' | 'results';
  capacity: number;
  players: { id: string; name: string; color: string }[];
  updatedAt: number;
};
export type RoomOptions = {
  title?: string;
  protected?: boolean;
  onListChange?: (summary: RoomSummary) => void;
};
export type Peer = {
  id: string;
  name: string;
  token: string;
  specials: number[];
  send: (data: unknown) => void;
  lastInput: number;
  window: number;
  messages: number;
  terrainSeq: number;
  connected: boolean;
};
export class RoomLogic {
  map: TerrainId = 'pirate';
  botLevel: BotLevel = 'normal';
  code: string;
  peers: Peer[] = [];
  world: World | null = null;
  host = '';
  capacity: number;
  totals: Record<string, { wins: number; kills: number; damage: number }> = {};
  ended = false;
  lastActive = Date.now();
  title: string;
  protected: boolean;
  onListChange?: (summary: RoomSummary) => void;
  constructor(code: string, capacity = 4, options: RoomOptions = {}) {
    this.code = code;
    this.capacity = Math.max(2, Math.min(6, capacity));
    this.title = (options.title || '').slice(0, 40) || defaultRoomTitle(code);
    this.protected = !!options.protected;
    this.onListChange = options.onListChange;
  }
  join(token: string, name: string, specials: number[], send: Peer['send']) {
    let peer = this.peers.find((p) => p.token === token);
    if (peer) {
      peer.send = send;
      peer.connected = true;
      peer.lastInput = 0;
      if (this.world) {
        const p = this.world.players.find((p) => p.id === peer!.id);
        if (p) {
          p.disconnected = 0;
          p.input.seq = 0;
        }
      }
    } else {
      if (this.peers.filter((p) => p.connected).length >= this.capacity)
        throw Error('Le salon est complet.');
      peer = {
        id: crypto.randomUUID(),
        name: name.slice(0, 18) || 'Moussaillon',
        token,
        specials: specials.filter((s) => s === -1 || SPECIALS.includes(s)).slice(0, 2),
        send,
        lastInput: 0,
        window: Date.now(),
        messages: 0,
        terrainSeq: 0,
        connected: true,
      };
      this.peers.push(peer);
      if (!this.host) this.host = peer.id;
    }
    if (!this.host) this.host = peer.id;
    this.lastActive = Date.now();
    send({ type: 'welcome', id: peer.id });
    this.broadcastLobby();
    if (this.world) this.state(peer, true);
    return peer;
  }
  lobby() {
    return {
      botLevel: this.botLevel,
      map: this.map,
      code: this.code,
      title: this.title,
      host: this.host,
      protected: this.protected,
      capacity: this.capacity,
      players: this.peers
        .filter((p) => p.connected)
        .map((p, i) => ({ id: p.id, name: p.name, color: COLORS[i] })),
      totals: this.totals,
    };
  }
  broadcastLobby() {
    this.broadcast({
      type: 'lobby',
      lobby: this.lobby(),
      state: this.world && !this.world.done ? 'play' : 'lobby',
    });
    this.publishList();
  }
  summary(): RoomSummary {
    return {
      code: this.code,
      title: this.title,
      host: this.host,
      protected: this.protected,
      state: this.world?.done ? 'results' : this.world ? 'play' : 'lobby',
      capacity: this.capacity,
      players: this.peers
        .filter((p) => p.connected)
        .map((p, i) => ({ id: p.id, name: p.name, color: COLORS[i] })),
      updatedAt: Date.now(),
    };
  }
  publishList() {
    this.onListChange?.(this.summary());
  }
  broadcast(data: unknown) {
    for (const p of this.peers)
      if (p.connected)
        try {
          p.send(data);
        } catch {
          p.connected = false;
        }
  }
  message(peer: Peer, data: any) {
    if (!peer.connected || !data || typeof data !== 'object') return;
    this.lastActive = Date.now();
    if (Date.now() - peer.window > 1000) {
      peer.window = Date.now();
      peer.messages = 0;
    }
    if (++peer.messages > 65) return;
    if (data.type === 'terrain') {
      if (peer.id !== this.host || (this.world && !this.world.done) || !isTerrainId(data.map)) return;
      this.map = data.map;
      this.broadcastLobby();
      return;
    }
    if (data.type === 'botLevel') {
      if (peer.id !== this.host || (this.world && !this.world.done) || !isBotLevel(data.level)) return;
      this.botLevel = data.level;
      this.broadcastLobby();
      return;
    }
    if (data.type === 'start') {
      if (peer.id !== this.host) return;
      if (this.world && !this.world.done) return;
      this.world = new World(Date.now() % 1000000, false, this.map);
      this.world.botLevel = this.botLevel;
      this.ended = false;
      const active = this.peers.filter((p) => p.connected);
      for (const p of active) {
        this.world.addPlayer(p.id, p.name, false, p.specials);
        p.terrainSeq = 0;
        p.lastInput = 0;
      }
      for (let i = active.length; i < this.capacity; i++)
        this.world.addPlayer(
          'bot' + i,
          [
            'Barbe-Boum',
            'La Teigne',
            'Croche-Pied',
            'Billy Boulet',
            'Plouf',
            'Rascal',
          ][i],
          true,
          [4, 8],
        );
      for (const p of active) this.state(p, true);
      this.publishList();
      return;
    }
    if (data.type === 'loadout') {
      if (this.world && !this.world.done) return;
      peer.specials = (Array.isArray(data.specials) ? data.specials : [])
        .filter((s: unknown) => typeof s === 'number' && (s === -1 || SPECIALS.includes(s)))
        .slice(0, 2);
      return;
    }
    if (data.type === 'sync') {
      if (this.world) this.state(peer, true);
      return;
    }
    if (data.type === 'chat') {
      if (this.world && !this.world.done) return;
      const text = typeof data.text === 'string' ? data.text.trim().slice(0, 180) : '';
      if (!text) return;
      this.broadcast({
        type: 'chat',
        message: {
          id: crypto.randomUUID(),
          player: peer.name,
          color: this.summary().players.find((p) => p.id === peer.id)?.color || COLORS[0],
          text,
          at: Date.now(),
        },
      });
      return;
    }
    if (data.type === 'input' && this.world && !this.world.done) {
      const input = data.input as Input;
      if (
        !input ||
        !Number.isSafeInteger(input.seq) ||
        input.seq <= peer.lastInput
      )
        return;
      peer.lastInput = input.seq;
      this.world.command(peer.id, input);
    }
  }
  state(peer: Peer, full = false) {
    if (!this.world) return;
    try {
      peer.send({
        type: 'state',
        snapshot: this.world.snapshot(full, full ? 0 : peer.terrainSeq),
      });
    } catch {
      peer.connected = false;
      return;
    }
    peer.terrainSeq = this.world.events.length;
  }
  step() {
    if (!this.world || this.world.done) return;
    this.world.step(DT);
    if (this.world.tick % 2 === 0 || this.world.done)
      for (const p of this.peers) if (p.connected) this.state(p);
    if (this.world.done && !this.ended) {
      this.ended = true;
      for (const p of this.world.players) {
        const old = this.totals[p.id] ?? { wins: 0, kills: 0, damage: 0 };
        this.totals[p.id] = {
          wins: old.wins + (this.world.winner === p.id ? 1 : 0),
          kills: old.kills + p.stats.kills,
          damage: old.damage + p.stats.damage,
        };
      }
      this.broadcast({ type: 'lobby', lobby: this.lobby(), state: 'results' });
      this.publishList();
    }
  }
  disconnect(peer: Peer) {
    peer.connected = false;
    if (this.world) {
      const p = this.world.players.find((p) => p.id === peer.id);
      if (p) {
        p.disconnected = this.world.time || 0.001;
        p.input.move = 0;
        p.input.jump = false;
        p.input.fire = false;
      }
    }
    if (peer.id === this.host)
      this.host = this.peers.find((p) => p.connected)?.id || '';
    this.broadcast({
      type: 'lobby',
      lobby: this.lobby(),
      state: this.world?.done ? 'results' : this.world ? 'play' : 'lobby',
    });
    this.publishList();
  }
}
function defaultRoomTitle(code: string) {
  const names = [
    'Le Pont Tremble',
    'La Cale Explosive',
    'Le Baril Maudit',
    'La Baie du Grabuge',
    'Le Radeau Sans Foi',
    'La Taverne Salee',
  ];
  let n = 0;
  for (const c of code) n += c.charCodeAt(0);
  return names[n % names.length];
}
