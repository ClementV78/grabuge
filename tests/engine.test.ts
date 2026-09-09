import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, DT, WEAPONS, blankInput, awards } from '../app/game/engine';
import { RoomLogic } from '../server/room';
function arena() {
  const w = new World(41);
  w.terrain.fill(0);
  w.circle(900, 930, 900, true, false);
  w.events = [];
  const p = w.addPlayer('a', 'Alpha');
  const q = w.addPlayer('b', 'Bravo');
  p.x = 400;
  p.y = 150;
  q.x = 700;
  q.y = 150;
  p.ammo.fill(-1);
  return { w, p, q };
}
test('same seed produces same terrain; destruction removes collision', () => {
  const a = new World(41),
    b = new World(41);
  assert.deepEqual(a.terrain, b.terrain);
  const y = a.surface(200) + 20;
  assert(a.solid(200, y));
  a.circle(200, y, 55);
  assert(!a.solid(200, y));
  assert.equal(a.events.length, 1);
});
test('global cooldown cannot be bypassed by switching weapons', () => {
  const { w, p } = arena();
  p.input = { ...blankInput(), weapon: 0 };
  w.fire(p);
  assert.equal(w.shots.length, 1);
  p.input.weapon = 1;
  w.fire(p);
  assert.equal(w.shots.length, 1);
  assert.equal(p.cd, 4);
});
test('invalid inputs and stale sequences cannot mutate state', () => {
  const { w, p } = arena();
  w.command('a', { seq: 1, move: NaN, tx: Infinity, weapon: 400 });
  assert.equal(p.input.move, 0);
  assert.equal(p.input.weapon, WEAPONS.length - 1);
  w.command('a', { seq: 1, move: 1 });
  assert.equal(p.input.move, 0);
});
test('all fifteen equipment types activate under legal conditions', () => {
  for (let weapon = 0; weapon < 15; weapon++) {
    const { w, p } = arena();
    w.terrain.fill(0);
    p.x = 400;
    p.y = 200;
    p.angle = 0;
    p.input = { ...blankInput(), weapon, angle: 0, tx: 540, ty: 200 };
    if (weapon === 12) w.circle(550, 200, 30, true, false);
    w.fire(p);
    assert(p.cd > 0, WEAPONS[weapon].name + ' did not activate');
    if ([0, 1, 2, 4, 5, 6, 7, 8, 11].includes(weapon))
      assert(w.shots.length > 0);
  }
});
test('one multi-projectile attack counts as one hit; self damage is separate', () => {
  const { w, p, q } = arena();
  p.stats.shots = 1;
  w.hit(q, p.id, 11, 2, 99, 100, -100);
  w.hit(q, p.id, 11, 2, 99, 100, -100);
  assert.equal(p.stats.hits, 1);
  assert.equal(p.stats.damage, 22);
  w.hit(p, p.id, 10, 0, 100, 0, 0);
  assert.equal(p.stats.self, 10);
  assert.equal(p.stats.damage, 22);
});
test('water kills require an active causal flight', () => {
  const { w, p, q } = arena();
  w.kill(q, undefined, true);
  assert.equal(p.stats.water, 0);
  const r = w.addPlayer('c', 'Charlie');
  w.hit(r, p.id, 1, 0, 3, 300, -200);
  w.kill(r, r.flight?.owner, true);
  assert.equal(p.stats.water, 1);
});
test('teleport is cancelled by damage; invalid foam placement consumes nothing', () => {
  const { w, p, q } = arena();
  w.terrain.fill(0);
  p.input = { ...blankInput(), weapon: 14, tx: 500, ty: 180 };
  w.fire(p);
  assert(p.teleport);
  w.hit(p, q.id, 1, 0, 1, 0, 0);
  assert.equal(p.teleport, null);
  p.cd = 0;
  p.ammo[9] = 2;
  p.input = { ...blankInput(), weapon: 9, tx: q.x, ty: q.y };
  w.fire(p);
  assert.equal(p.ammo[9], 2);
  assert.equal(w.foams.length, 0);
});
test('grapple and jetpack block attacks', () => {
  const { w, p } = arena();
  p.rope = { x: 400, y: 50, length: 100 };
  w.fire(p);
  assert.equal(w.shots.length, 0);
  p.rope = null;
  p.jet = 2;
  w.fire(p);
  assert.equal(w.shots.length, 0);
});
test('two and four client rooms agree on authoritative terrain and state', () => {
  for (const n of [2, 4]) {
    const r = new RoomLogic('ABCDEF', n);
    const inbox: any[][] = [];
    const peers = Array.from({ length: n }, (_, i) => {
      inbox[i] = [];
      return r.join('token-' + i, 'Player ' + i, [4, 8], (d) =>
        inbox[i].push(d),
      );
    });
    r.message(peers[0], { type: 'start' });
    for (let i = 0; i < 60; i++) r.step();
    r.world!.circle(500, 650, 80);
    for (let i = 0; i < 2; i++) r.step();
    const states = inbox.map(
      (a) => a.filter((m) => m.type === 'state').at(-1).snapshot,
    );
    for (const s of states.slice(1)) {
      assert.deepEqual(s.players, states[0].players);
      assert.deepEqual(s.events, states[0].events);
    }
    assert.equal(r.world!.players.length, n);
  }
});
test('reconnection keeps identity and sends terrain; spectator cannot inject player', () => {
  const r = new RoomLogic('ABCDEF');
  const a = r.join('token-a', 'Alpha', [4, 8], () => {});
  r.message(a, { type: 'start' });
  r.disconnect(a);
  let full = false;
  const again = r.join('token-a', 'Alpha', [4, 8], (m: any) => {
    if (m.type === 'state' && m.snapshot.terrain) full = true;
  });
  assert.equal(again.id, a.id);
  assert(full);
  const late = r.join('token-b', 'Late', [], () => {});
  assert(!r.world!.players.some((p) => p.id === late.id));
  r.message(late, {
    type: 'input',
    input: { ...blankInput(), seq: 1, fire: true },
  });
  assert.equal(r.world!.shots.length, 0);
});
test('results, ties, rematch totals', () => {
  const r = new RoomLogic('ABCDEF', 2);
  const a = r.join('token-a', 'Alpha', [], () => {});
  r.message(a, { type: 'start' });
  const [p, q] = r.world!.players;
  p.stats.terrain = q.stats.terrain = 100;
  assert(awards([p, q], p.id)[0].names.includes('&'));
  r.world!.kill(q, p.id);
  r.step();
  assert(r.world!.done);
  assert.equal(r.totals[p.id].wins, 1);
  r.message(a, { type: 'start' });
  assert(!r.world!.done);
  assert.equal(r.totals[p.id].wins, 1);
});
test('room metadata and lobby chat are public but not replayed', () => {
  const r = new RoomLogic('ABCDEF', 4, {
    title: 'Pont des testeurs',
    protected: true,
  });
  const inboxA: any[] = [],
    inboxB: any[] = [],
    inboxC: any[] = [];
  const a = r.join('token-a', 'Alpha', [4, 8], (m) => inboxA.push(m));
  r.join('token-b', 'Bravo', [4, 8], (m) => inboxB.push(m));
  assert.equal(r.lobby().title, 'Pont des testeurs');
  assert.equal(r.lobby().protected, true);
  assert.equal(r.summary().players.length, 2);
  r.message(a, { type: 'chat', text: 'Salut le pont' });
  assert.equal(inboxA.filter((m) => m.type === 'chat').length, 1);
  assert.equal(inboxB.filter((m) => m.type === 'chat').length, 1);
  r.join('token-c', 'Charlie', [4, 8], (m) => inboxC.push(m));
  assert.equal(inboxC.filter((m) => m.type === 'chat').length, 0);
});
test('bot match completes; simulation performance with four players', () => {
  const w = new World(94);
  for (let i = 0; i < 4; i++) w.addPlayer('b' + i, 'Bot' + i, true);
  const start = performance.now();
  for (let i = 0; i < 12000 && !w.done; i++) w.step();
  assert(w.done);
  assert(w.players.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  console.log(
    'bot match:',
    w.time.toFixed(1),
    's; CPU',
    Math.round(performance.now() - start),
    'ms; events',
    w.events.length,
  );
});

test('grenade fuse detonates and modifies terrain', () => {
  const w = new World(51, true),
    p = w.addPlayer('a', 'A');
  p.input = { ...blankInput(), weapon: 1, fuse: 1, power: 0.15 };
  p.angle = 0.6;
  w.fire(p);
  for (let i = 0; i < 40; i++) w.step();
  assert(w.events.length > 0);
  assert.equal(w.shots.filter((s) => s.weapon === 1).length, 0);
});
test('foam expires and explosion removes temporary collision', () => {
  const { w, p } = arena();
  w.terrain.fill(0);
  p.input = { ...blankInput(), weapon: 9, tx: 530, ty: 150 };
  w.fire(p);
  assert(w.solid(530, 150));
  w.time = 13;
  w.step();
  assert(!w.solid(530, 150));
});
test('a shot cannot originate through a thin wall', () => {
  const { w, p } = arena();
  w.terrain.fill(0);
  p.x = 400;
  p.y = 200;
  p.angle = 0;
  w.circle(414, 200, 3, true, false);
  p.input = { ...blankInput(), weapon: 0 };
  w.fire(p);
  assert(w.shots[0].x <= 414);
  assert.equal(w.shots[0].life, 0);
});
test('sustained movement, buffered jump and grapple remain finite', () => {
  const w = new World(4, true),
    p = w.addPlayer('a', 'A');
  for (let i = 0; i < 300; i++) {
    p.input = { ...blankInput(), move: 1, jump: i % 50 === 0 };
    w.step();
  }
  assert(p.x > 220);
  assert(Number.isFinite(p.y));
  assert(!w.body(p.x, p.y));
});
test('disconnected player is eliminated after grace period', () => {
  const r = new RoomLogic('DCHECK', 2);
  const peer = r.join('token-a', 'A', [], () => {});
  r.message(peer, { type: 'start' });
  r.step();
  r.disconnect(peer);
  r.world!.time += 16;
  r.step();
  assert.equal(r.world!.players[0].alive, false);
});

test('holding charge increases bazooka and sticky-bomb launch speed', () => {
  for (const weapon of [0, 1, 6, 8]) {
    const { w, p } = arena();
    w.terrain.fill(0);
    p.input = { ...blankInput(), weapon, power: 0.15 };
    w.fire(p);
    const low = Math.hypot(w.shots[0].vx, w.shots[0].vy);
    p.cd = 0;
    p.input.power = 1;
    w.fire(p);
    assert(Math.hypot(w.shots.at(-1)!.vx, w.shots.at(-1)!.vy) > low * 1.5);
  }
});
test('pigeon steers toward pointer rather than the pirate heading', () => {
  const { w, p } = arena();
  w.training = true;
  w.terrain.fill(0);
  p.x = 400;
  p.y = 200;
  p.angle = 0;
  p.input = { ...blankInput(), weapon: 5, angle: 0, tx: 600, ty: 80 };
  w.fire(p);
  const shot = w.shots[0];
  for (let i = 0; i < 8; i++) w.step();
  assert(shot.vy < 0);
  assert(p.pilot);
  p.input.action = true;
  w.step();
  assert.equal(p.pilot, 0);
});
test('walk over a twelve pixel step without jumping', () => {
  const w = new World(1, true);
  w.terrain.fill(0);
  for (let x = 0; x < 450; x++)
    for (let y = x < 100 ? 150 : 147; y < 250; y++) w.terrain[y * 450 + x] = 1;
  const p = w.addPlayer('a', 'A');
  p.x = 365;
  p.y = 579;
  for (let i = 0; i < 45; i++) {
    p.input = { ...blankInput(), move: 1 };
    w.step();
  }
  assert(p.x > 430, 'must climb small step');
  assert(!w.body(p.x, p.y));
});
test('jump can clear an ordinary grenade crater', () => {
  const w = new World(1, true);
  w.terrain.fill(0);
  for (let x = 0; x < 450; x++)
    for (let y = 150; y < 250; y++) w.terrain[y * 450 + x] = 1;
  w.circle(450, 600, 70);
  const p = w.addPlayer('a', 'A');
  p.x = 450;
  p.y = 646;
  for (let i = 0; i < 10; i++) w.step();
  for (let i = 0; i < 50; i++) {
    p.input = { ...blankInput(), move: 1, jump: i < 2 };
    w.step();
  }
  assert(p.x > 525, 'must leave crater');
  assert(!w.body(p.x, p.y));
});

test('bazooka and cork gun actually damage an opponent',()=>{for(const weapon of [0,2]){const{w,p,q}=arena();w.training=true;w.terrain.fill(0);p.x=400;p.y=150;q.x=470;q.y=150;p.angle=0;p.input={...blankInput(),weapon,angle:0};w.fire(p);for(let i=0;i<15;i++)w.step();assert(p.stats.damage>0,WEAPONS[weapon].name+' must hit')}});
test('spring glove actually applies damage and knockback after preparation',()=>{const{w,p,q}=arena();w.terrain.fill(0);q.x=p.x+55;p.input={...blankInput(),weapon:3,angle:0};p.angle=0;w.fire(p);assert.equal(q.hp,100);for(let i=0;i<10;i++)w.step();assert.equal(q.hp,80);assert(q.vx>0)});
test('mole crosses terrain and detonates at its drilling limit',()=>{const{w,p}=arena();w.training=true;w.terrain.fill(0);p.x=300;p.y=200;p.angle=0;w.circle(490,200,120,true,false);p.input={...blankInput(),weapon:4,angle:0};w.fire(p);let drilled=false;for(let i=0;i<70;i++){w.step();if(w.shots.some(s=>s.drill>0))drilled=true;}assert(drilled);assert(w.events.length>0)});
test('popcorn produces bounded fragments with the original attack identity',()=>{const{w,p}=arena();w.training=true;w.terrain.fill(0);p.x=400;p.y=250;p.angle=-1.2;p.input={...blankInput(),weapon:6,power:.5,angle:-1.2};w.fire(p);const attack=w.shots[0].attack;for(let i=0;i<61;i++)w.step();const fragments=w.shots.filter(s=>s.weapon===1);assert(fragments.length>0&&fragments.length<=6);assert(fragments.every(s=>s.attack===attack&&s.originWeapon===6));assert.equal(p.stats.shots,1)});
test('mine arms, jumps near enemy and explodes',()=>{const{w,p,q}=arena();w.training=true;w.terrain.fill(0);q.x=650;q.y=200;p.input={...blankInput(),weapon:7};w.fire(p);const mine=w.shots[0];mine.x=640;mine.y=200;mine.age=1.3;w.step();assert(mine.armed);assert(mine.vy<0);for(let i=0;i<18;i++)w.step();assert(!w.shots.includes(mine));assert(w.events.length>0)});
test('sticky bomb attaches then can be removed with E',()=>{const{w,p,q}=arena();w.training=true;w.terrain.fill(0);p.input={...blankInput(),weapon:8};w.fire(p);const bomb=w.shots[0];bomb.x=q.x-3;bomb.y=q.y;bomb.age=.4;bomb.vx=bomb.vy=0;w.step();assert.equal(bomb.target,q.id);q.input.action=true;w.step();assert.equal(bomb.target,undefined);assert(!bomb.stuck)});
test('foam can overlap a ground edge, has collision and does not consume on invalid target',()=>{const{w,p,q}=arena();w.training=true;w.terrain.fill(0);p.x=400;p.y=200;q.x=1000;q.y=100;w.circle(550,270,65,true,false);p.input={...blankInput(),weapon:9,tx:550,ty:230};p.ammo[9]=2;w.fire(p);assert.equal(w.foams.length,1);assert(w.solid(550,200));assert.equal(p.ammo[9],1);p.cd=0;p.input.tx=1000;w.fire(p);assert.equal(p.ammo[9],1);assert(w.effects.some(e=>e.type==='refused'))});
test('magnet changes velocity of metal projectiles',()=>{const{w,p,q}=arena();w.training=true;w.terrain.fill(0);p.x=400;p.y=200;q.x=1000;q.y=100;p.magnet=3;q.input={...blankInput(),weapon:0};w.fire(q);const shot=w.shots[0];shot.x=500;shot.y=200;shot.vx=shot.vy=0;w.step();assert(shot.vx<0)});
test('fridge falls and creates a large impact',()=>{const{w,p,q}=arena();w.training=true;w.terrain.fill(0);for(let x=0;x<450;x++)for(let y=150;y<250;y++)w.terrain[y*450+x]=1;p.x=400;p.y=579;q.x=600;q.y=579;p.input={...blankInput(),weapon:11,tx:600,ty:560};w.fire(p);for(let i=0;i<150;i++)w.step();assert(w.events.some(e=>e.r===105));assert(p.stats.damage>0)});
test('grapple anchors and jetpack actually lifts the player',()=>{const{w,p}=arena();w.training=true;w.terrain.fill(0);p.x=400;p.y=300;w.circle(400,100,25,true,false);p.angle=-Math.PI/2;p.input={...blankInput(),weapon:12,angle:p.angle};w.fire(p);assert(p.rope);for(let i=0;i<10;i++)w.step();assert(p.rope);assert(Math.hypot(p.x-p.rope.x,p.y-p.rope.y)<=p.rope.length+1);p.rope=null;p.cd=0;p.input.weapon=13;w.fire(p);const before=p.y;for(let i=0;i<20;i++)w.step();assert(p.y<before-20)});
test('teleport reaches its valid destination after preparation',()=>{const{w,p,q}=arena();w.training=true;w.terrain.fill(0);p.x=400;p.y=200;q.x=1000;q.y=200;p.input={...blankInput(),weapon:14,tx:650,ty:200};w.fire(p);assert(p.teleport);for(let i=0;i<37;i++)w.step();assert.equal(p.teleport,null);assert.equal(p.x,650)});
