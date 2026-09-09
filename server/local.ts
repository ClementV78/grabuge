import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { RoomLogic, type RoomSummary } from './room';
const rooms = new Map<string, RoomLogic>();
const passwords = new Map<string, { salt: string; hash: string }>();
const registry = new Map<string, RoomSummary>();
const registryUpdates = new Map<string, number>();
const readBody = (req: IncomingMessage) =>
  new Promise<any>((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
const hashPassword = async (password: string, salt: string) => {
  const data = new TextEncoder().encode(salt + ':' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};
const generatedTitle = (code: string) => {
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
};
const server = createServer((req, res) => {
  void handle(req, res);
});
async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET' && req.url === '/api/rooms') {
    const now = Date.now();
    for (const [code, room] of registry)
      if (!room.players.length || now - room.updatedAt > 90000)
        registry.delete(code);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        rooms: [...registry.values()].sort((a, b) => b.updatedAt - a.updatedAt),
      }),
    );
    return;
  }
  if (req.method === 'POST' && req.url === '/api/rooms') {
    const body = await readBody(req);
    const code = crypto
      .randomUUID()
      .replaceAll('-', '')
      .slice(0, 6)
      .toUpperCase();
    const title =
      (typeof body.title === 'string' ? body.title.trim().slice(0, 40) : '') ||
      generatedTitle(code);
    const password =
      typeof body.password === 'string' ? body.password.trim() : '';
    if (password) {
      const salt = crypto.randomUUID();
      passwords.set(code, { salt, hash: await hashPassword(password, salt) });
    }
    rooms.set(
      code,
      new RoomLogic(code, 4, {
        title,
        protected: !!password,
        onListChange: (summary) => {
          if (summary.players.length) {
            registry.set(code, summary);
            registryUpdates.set(code, Date.now());
          } else {
            registry.delete(code);
            registryUpdates.delete(code);
          }
        },
      }),
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code, title, protected: !!password }));
    return;
  }
  res.writeHead(404);
  res.end('Salon introuvable');
}
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url!, 'http://localhost'),
    match = u.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})$/),
    room = match && rooms.get(match[1]);
  if (!room) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  void handleRoomUpgrade(u, room, req, socket, head);
});
async function handleRoomUpgrade(
  u: URL,
  room: RoomLogic,
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) {
  const password = passwords.get(room.code);
  if (password) {
    const candidate = u.searchParams.get('password') || '';
    if (!candidate || (await hashPassword(candidate, password.salt)) !== password.hash) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    let peer;
    try {
      peer = room.join(
        u.searchParams.get('token') || crypto.randomUUID(),
        u.searchParams.get('name') || 'Pirate',
        (u.searchParams.get('specials') || '4,8').split(',').map(Number),
        (data) => ws.send(JSON.stringify(data)),
      );
    } catch {
      ws.close(1008, 'Salon complet');
      return;
    }
    ws.on('message', (raw) => {
      try {
        room.message(peer, JSON.parse(raw.toString()));
      } catch {}
    });
    ws.on('close', () => room.disconnect(peer));
  });
}
setInterval(() => {
  for (const [code, room] of rooms) {
    room.step();
    if (
      room.peers.some((p) => p.connected) &&
      Date.now() - (registryUpdates.get(code) || 0) > 10000
    ) {
      registry.set(code, room.summary());
      registryUpdates.set(code, Date.now());
    }
    if (
      !room.peers.some((p) => p.connected) &&
      Date.now() - room.lastActive > 60000
    ) {
      rooms.delete(code);
      registry.delete(code);
      registryUpdates.delete(code);
      passwords.delete(code);
    }
  }
}, 1000 / 30);
server.listen(8788, '127.0.0.1', () =>
  console.log('Grabuge rooms: http://127.0.0.1:8788'),
);
