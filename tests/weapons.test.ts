import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, SPECIALS, blankInput, type Shot } from '../app/game/engine';
import { RoomLogic } from '../server/room';
import { TERRAINS, type TerrainId } from '../app/game/terrains';

test('terrains are deterministic, distinct and have clear supported spawns', () => {
  const masks = [];
  for (const map of Object.keys(TERRAINS) as TerrainId[]) {
    const world = new World(42, false, map);
    assert.deepEqual(world.terrain, new World(42, false, map).terrain);
    assert.equal(world.snapshot().map, map);
    for (let i = 0; i < 6; i++) {
      const p = world.addPlayer(String(i), 'Test');
      assert(p.y < world.water - 30);
      assert(!world.body(p.x, p.y), `${map}: spawn ${i} intersects terrain`);
      assert(world.solid(p.x, p.y + 28));
    }
    masks.push(world.terrain);
  }
  assert.notDeepEqual(masks[0], masks[1]);
  assert.notDeepEqual(masks[1], masks[2]);
});

test('random slots exclude duplicates and crate-only lightning', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const world = new World(seed);
    for (const selection of [[-1, -1], [-1, 16], [16, -1]]) {
      const p = world.addPlayer(String(selection), 'Test', false, selection);
      const owned = SPECIALS.filter((w) => p.ammo[w] > 0);
      assert.equal(owned.length, 2);
      if (selection.includes(16)) assert(owned.includes(16));
      assert.equal(p.ammo[15], 0);
    }
  }
});

test('lightning damages opponents only and consumes one charge', () => {
  const world = new World(1);
  const a = world.addPlayer('a', 'A');
  const b = world.addPlayer('b', 'B');
  const c = world.addPlayer('c', 'C');
  a.ammo[15] = 1;
  a.input = { ...blankInput(), weapon: 15 };
  world.fire(a);
  assert.deepEqual([a.hp, b.hp, c.hp], [100, 88, 88]);
  assert.equal(a.ammo[15], 0);
  assert.equal(a.stats.hits, 1);
});

function projectile(weapon: number): Shot {
  return { id: 100, attack: 99, owner: 'a', weapon, originWeapon: weapon,
    x: 700, y: 100, vx: 0, vy: 0, life: 1, age: 0, travel: 0,
    drill: 0, stuck: false, armed: false, hp: 8 };
}

test('glue lasts three seconds, does not refresh, allows firing and gravity', () => {
  const world = new World(1, true);
  world.terrain.fill(0);
  world.addPlayer('a', 'A');
  const b = world.addPlayer('b', 'B');
  b.x = 700; b.y = 100;
  world.explode(projectile(16));
  assert.equal(b.glued, 3);
  b.input = { ...blankInput(), move: 1, jump: true };
  world.move(b, 0.1);
  assert.equal(b.vx, 0);
  assert(b.vy > 0);
  world.explode(projectile(16));
  assert.equal(b.glued, 2.9);
  world.fire(b);
  assert.equal(world.shots.length, 1);
  for (let n = 0; n < 30; n++) world.move(b, 0.1);
  assert.equal(b.glued, 0);
  assert(b.vx > 0);
});

test('firework fragments descend, share attack identity and do not multiply', () => {
  const world = new World(1);
  world.explode(projectile(17));
  assert.equal(world.shots.length, 18);
  assert(world.shots.every((s) => s.vy > 0 && s.attack === 99 && s.originWeapon === 17));
  world.explode(world.shots[0]);
  assert.equal(world.shots.length, 18);
});

test('only host can set valid difficulty and terrain before a round', () => {
  const room = new RoomLogic('ABCDEF');
  const host = room.join('a', 'A', [-1, 16], () => {});
  const guest = room.join('b', 'B', [4, 8], () => {});
  room.message(guest, { type: 'terrain', map: 'snow' });
  room.message(host, { type: 'terrain', map: 'invalid' });
  assert.equal(room.map, 'pirate');
  room.message(host, { type: 'terrain', map: 'canyon' });
  room.message(guest, { type: 'botLevel', level: 'expert' });
  assert.equal(room.botLevel, 'normal');
  room.message(host, { type: 'botLevel', level: 'expert' });
  room.message(host, { type: 'start' });
  assert.equal(room.world?.botLevel, 'expert');
  assert.equal(room.world?.snapshot().map, 'canyon');
  room.message(host, { type: 'terrain', map: 'snow' });
  assert.equal(room.map, 'canyon');
  room.message(host, { type: 'botLevel', level: 'easy' });
  assert.equal(room.botLevel, 'expert');
});

test('glue and firework respect aim and charge', () => {
  for (const weapon of [16, 17]) {
    const world = new World(1, true);
    world.terrain.fill(0);
    const p = world.addPlayer('a', 'A');
    p.x = 700; p.y = 200;
    p.angle = -0.6;
    p.input = { ...blankInput(), weapon, power: 0.2 };
    world.fire(p);
    const low = world.shots[0];
    p.cd = 0;
    p.input.power = 1;
    world.fire(p);
    assert(world.shots[1].vx > low.vx);
    assert(world.shots[1].vy < low.vy);
    p.cd = 0; p.angle = -Math.PI + 0.6;
    world.fire(p);
    assert(world.shots[2].vx < 0);
  }
});

test('easy bots fire significantly less often than normal bots', () => {
  const shots = (level: 'easy' | 'normal') => {
    const world = new World(2);
    world.botLevel = level;
    const p = world.addPlayer('a', 'A', true);
    world.addPlayer('b', 'B');
    let count = 0;
    for (let tick = 1; tick <= 1800; tick++) {
      world.tick = tick;
      p.cd = Math.max(0, p.cd - 1 / 30);
      world.bot(p, 1 / 30);
      if (p.input.fire) { count++; p.cd = 4; p.input.fire = false; }
    }
    return count;
  };
  assert(shots('easy') <= shots('normal') / 2);
});
