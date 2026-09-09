import { WebSocket } from 'ws';
import assert from 'node:assert/strict';
const base = process.env.GAME_TEST_URL || 'http://127.0.0.1:8788';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function join(code: string, token: string, name: string, delay = 0) {
  const ws = new WebSocket(
    base.replace('http', 'ws') +
      '/api/rooms/' +
      code +
      '?token=' +
      token +
      '&name=' +
      name +
      '&specials=4,8',
  );
  const messages: any[] = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  for (let i = 0; i < 60 && !messages.some((m) => m.type === 'welcome'); i++)
    await wait(20);
  assert(messages.some((m) => m.type === 'welcome'));
  return {
    ws,
    messages,
    token,
    send: (d: any) => setTimeout(() => ws.send(JSON.stringify(d)), delay),
  };
}
for (const n of [2, 4]) {
  const res = await fetch(base + '/api/rooms', { method: 'POST' });
  assert(res.ok);
  const { code } = (await res.json()) as any;
  const clients = [];
  for (let i = 0; i < n; i++)
    clients.push(
      await join(code, crypto.randomUUID(), 'QA' + i, i === n - 1 ? 100 : 0),
    );
  clients[0].send({ type: 'start' });
  await wait(200);
  for (let step = 1; step <= 35; step++) {
    for (const [i, c] of clients.entries())
      c.send({
        type: 'input',
        input: {
          seq: step,
          move: 0,
          jump: step === 5,
          angle: -0.65,
          tx: 900,
          ty: 300,
          weapon: 0,
          fire: step === 4,
          power: 0.8,
          fuse: 2,
          action: false,
        },
      });
    await wait(34);
  }
  await wait(250);
  const states = clients.map(
    (c) => c.messages.filter((m) => m.type === 'state').at(-1)?.snapshot,
  );
  assert(states.every(Boolean));
  assert(states.every((s) => s.players.length === 4));
  const commonTick = Math.min(...states.map((s) => s.tick));
  const same = clients.map(
    (c) =>
      c.messages
        .filter((m) => m.type === 'state' && m.snapshot.tick === commonTick)
        .at(-1)?.snapshot,
  );
  assert(same.every(Boolean));
  for (const s of same.slice(1)) assert.deepEqual(s.players, same[0].players);
  const token = clients[n - 1].token,
    id = clients[n - 1].messages.find((m) => m.type === 'welcome').id;
  clients[n - 1].ws.close();
  await wait(100);
  const re = await join(code, token, 'QA-reconnect');
  assert.equal(re.messages.find((m) => m.type === 'welcome').id, id);
  assert(re.messages.some((m) => m.type === 'state' && m.snapshot.terrain));
  re.ws.close();
  for (const c of clients) c.ws.close();
  console.log(
    n +
      ' real WebSocket clients: authoritative state equal at tick ' +
      commonTick +
      ', 100 ms delayed commands, reconnect/full terrain OK',
  );
}

