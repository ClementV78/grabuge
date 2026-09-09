import { WebSocket } from 'ws';
import assert from 'node:assert/strict';
import { WEAPONS, SPECIALS } from '../app/game/engine';
const base = 'http://127.0.0.1:8788';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function join(code: string, name: string, specials: string) {
  const ws = new WebSocket(
    base.replace('http', 'ws') + '/api/rooms/' + code +
    '?token=' + crypto.randomUUID() + '&name=' + name + '&specials=' + specials,
  );
  const messages: any[] = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  await new Promise<void>((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  for (let i = 0; i < 60 && !messages.some((m) => m.type === 'welcome'); i++) await wait(20);
  const id = messages.find((m) => m.type === 'welcome').id;
  return { ws, messages, id, send: (d: any) => ws.send(JSON.stringify(d)) };
}
const owned = (snap: any, id: string) =>
  SPECIALS.filter((i) => snap.players.find((p: any) => p.id === id).ammo[i] !== 0);

const { code } = (await (await fetch(base + '/api/rooms', { method: 'POST' })).json()) as any;
// A rejoint avec le defaut 4,8 puis change d'avis dans le lobby : 9 et 13
const a = await join(code, 'Alice', '4,8');
const b = await join(code, 'Bob', '4,8');
a.send({ type: 'loadout', specials: [9, 13] });
await wait(150);
a.send({ type: 'start' });
await wait(400);
const snap = a.messages.filter((m) => m.type === 'state').pop().snapshot;
const got = owned(snap, a.id), exp = owned(snap, b.id);
console.log('Alice apres loadout :', got.map((i) => WEAPONS[i].name).join(', '));
console.log('Bob sans loadout    :', exp.map((i) => WEAPONS[i].name).join(', '));
assert.deepEqual(got, [9, 13], 'le loadout du lobby doit remplacer le choix initial');
assert.deepEqual(exp, [4, 8], 'sans loadout, le choix de l URL est conserve');

// rejet : arme hors SPECIALS, et plus de 2
const { code: c2 } = (await (await fetch(base + '/api/rooms', { method: 'POST' })).json()) as any;
const d = await join(c2, 'Dora', '4,8');
d.send({ type: 'loadout', specials: [0, 3, 9, 13, 14] });
await wait(150);
d.send({ type: 'start' });
await wait(400);
const s2 = d.messages.filter((m) => m.type === 'state').pop().snapshot;
const g2 = owned(s2, d.id);
console.log('Dora, entree invalide :', g2.map((i) => WEAPONS[i].name).join(', '));
assert.deepEqual(g2, [9, 13], 'le serveur doit filtrer hors-SPECIALS et couper a 2');
console.log('\nOK : loadout applique, valide et borne a 2.');
process.exit(0);
