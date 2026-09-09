import { DurableObject } from 'cloudflare:workers';
import { RoomLogic, type Peer, type RoomSummary } from './room';
interface Env {
  ROOMS: DurableObjectNamespace;
  REGISTRY: DurableObjectNamespace;
  ALLOWED_ORIGIN?: string;
  MAX_PLAYERS?: string;
}
type StoredRoom = {
  code: string;
  title: string;
  salt: string;
  passwordHash: string;
  protected: boolean;
  created: number;
};
type CreateRoomBody = {
  title?: string;
  password?: string;
};
const ROOM_TTL = 15 * 60 * 1000;
const ACTIVE_TTL = 90 * 1000;
const cleanTitle = (value: unknown, code: string) =>
  (typeof value === 'string' ? value.trim().slice(0, 40) : '') ||
  generatedTitle(code);
function generatedTitle(code: string) {
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
async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(salt + ':' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
async function roomPassword(body: unknown) {
  const raw =
    body && typeof body === 'object' && 'password' in body
      ? (body as CreateRoomBody).password
      : '';
  const password = typeof raw === 'string' ? raw.trim() : '';
  if (!password) return { salt: '', passwordHash: '' };
  const salt = crypto.randomUUID();
  return { salt, passwordHash: await hashPassword(password, salt) };
}
export class RoomRegistry extends DurableObject<Env> {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/rooms') {
      const room = (await request.json()) as RoomSummary;
      if (room.players.length) await this.ctx.storage.put(room.code, room);
      else await this.ctx.storage.delete(room.code);
      return new Response('ok');
    }
    if (request.method === 'DELETE' && url.pathname.startsWith('/rooms/')) {
      await this.ctx.storage.delete(url.pathname.split('/').pop()!);
      return new Response('ok');
    }
    if (request.method === 'GET' && url.pathname === '/rooms') {
      const all = await this.ctx.storage.list<RoomSummary>();
      const now = Date.now();
      const rooms = [...all.values()]
        .filter((r) => r.players.length && now - r.updatedAt < ACTIVE_TTL)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      for (const r of all.values())
        if (!r.players.length || now - r.updatedAt >= ACTIVE_TTL)
          await this.ctx.storage.delete(r.code);
      return Response.json({ rooms });
    }
    return new Response('Not found', { status: 404 });
  }
}
export class GameRoom extends DurableObject<Env> {
  room: RoomLogic | null = null;
  timer: ReturnType<typeof setInterval> | null = null;
  saved: StoredRoom | null = null;
  lastRegistryUpdate = 0;
  registry() {
    return this.env.REGISTRY.get(this.env.REGISTRY.idFromName('global'));
  }
  publish(summary: RoomSummary) {
    this.lastRegistryUpdate = Date.now();
    void this.registry().fetch('https://registry/rooms', {
      method: 'POST',
      body: JSON.stringify(summary),
    });
  }
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/init')) {
      const body =
        request.method === 'POST' ? ((await request.json().catch(() => ({}))) as CreateRoomBody) : {};
      const code = url.searchParams.get('code')!;
      const password = await roomPassword(body);
      const title = cleanTitle(body.title, code);
      this.saved = {
        code,
        title,
        salt: password.salt,
        passwordHash: password.passwordHash,
        protected: !!password.passwordHash,
        created: Date.now(),
      };
      this.room = new RoomLogic(
        code,
        Number(this.env.MAX_PLAYERS) || 4,
        {
          title,
          protected: !!password.passwordHash,
          onListChange: (summary) => this.publish(summary),
        },
      );
      await this.ctx.storage.put('room', this.saved);
      return new Response('ok');
    }
    if (!this.room) {
      const saved = await this.ctx.storage.get<StoredRoom>('room');
      if (saved && Date.now() - saved.created < ROOM_TTL) {
        this.saved = saved;
        this.room = new RoomLogic(
          saved.code,
          Number(this.env.MAX_PLAYERS) || 4,
          {
            title: saved.title,
            protected: saved.protected,
            onListChange: (summary) => this.publish(summary),
          },
        );
      }
    }
    if (request.headers.get('Upgrade') !== 'websocket')
      return new Response('WebSocket requis', { status: 426 });
    if (!this.room)
      return new Response('Salon expiré, recrée un salon.', { status: 404 });
    if (this.saved?.passwordHash) {
      const candidate = url.searchParams.get('password') || '';
      const ok =
        candidate &&
        (await hashPassword(candidate, this.saved.salt)) ===
          this.saved.passwordHash;
      if (!ok) return new Response('Mot de passe incorrect', { status: 401 });
    }
    const token = url.searchParams.get('token') || '';
    if (!/^[a-zA-Z0-9-]{20,80}$/.test(token))
      return new Response('Identité invalide', { status: 400 });
    const pair = new WebSocketPair(),
      client = pair[0],
      server = pair[1];
    server.accept();
    let peer: Peer;
    try {
      peer = this.room.join(
        token,
        url.searchParams.get('name') || '',
        (url.searchParams.get('specials') || '').split(',').map(Number),
        (data) => server.send(JSON.stringify(data)),
      );
    } catch (e) {
      server.close(1008, (e as Error).message);
      return new Response(null, { status: 101, webSocket: client });
    }
    server.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || event.data.length > 4096) {
        server.close(1009);
        return;
      }
      try {
        this.room?.message(peer, JSON.parse(event.data));
        this.ensureTimer();
      } catch {
        server.send(
          JSON.stringify({ type: 'error', message: 'Commande invalide' }),
        );
      }
    });
    server.addEventListener('close', () => {
      this.room?.disconnect(peer);
    });
    server.addEventListener('error', () => {
      this.room?.disconnect(peer);
    });
    this.ensureTimer();
    return new Response(null, { status: 101, webSocket: client });
  }
  ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try {
        this.room?.step();
        if (
          this.room?.peers.some((p) => p.connected) &&
          Date.now() - this.lastRegistryUpdate > 10000
        )
          this.publish(this.room.summary());
      } catch {
        clearInterval(this.timer!);
        this.timer = null;
        return;
      }
      if (
        !this.room ||
        (!this.room.peers.some((p) => p.connected) &&
          Date.now() - this.room.lastActive > 20000) ||
        this.room.world?.done
      ) {
        const room = this.room;
        if (room && !room.peers.some((p) => p.connected))
          void this.registry().fetch('https://registry/rooms/' + room.code, {
            method: 'DELETE',
          });
        clearInterval(this.timer!);
        this.timer = null;
      }
    }, 1000 / 30);
  }
}
export default {
  async fetch(request: Request, env: Env) {
    const u = new URL(request.url),
      origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGIN || u.origin;
    const headers = {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    if (origin && origin !== allowed)
      return new Response('Origine refusée', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (u.pathname === '/api/rooms' && request.method === 'GET') {
      const registry = env.REGISTRY.get(env.REGISTRY.idFromName('global'));
      const res = await registry.fetch('https://registry/rooms');
      return new Response(res.body, {
        status: res.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
    if (u.pathname === '/api/rooms' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as CreateRoomBody;
      const code = crypto
        .randomUUID()
        .replaceAll('-', '')
        .slice(0, 6)
        .toUpperCase();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      await stub.fetch('https://room/init?code=' + code, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return Response.json(
        { code, title: cleanTitle(body.title, code), protected: !!body.password },
        { headers },
      );
    }
    const match = u.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})$/);
    if (match) {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(match[1]));
      return stub.fetch(request);
    }
    return new Response('Grabuge multiplayer', { headers });
  },
};
