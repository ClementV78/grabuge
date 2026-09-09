import type { TerrainId } from './terrains';
import { generateTerrain } from './terrain-layouts';
export const W = 1800,
  H = 1000,
  CELL = 4,
  COLS = W / CELL,
  ROWS = H / CELL,
  DT = 1 / 30;
export const COLORS = [
  '#ffca55',
  '#61d6d1',
  '#fb8261',
  '#b4adff',
  '#9fe176',
  '#ff8da7',
];
export const POWER_WEAPONS = [0, 1, 6, 8, 16, 17];
export const SPECIALS = [4, 5, 7, 8, 9, 10, 13, 14, 16, 17];
export const BOT_LEVELS = ['easy', 'normal', 'hard', 'expert'] as const;
export type BotLevel = typeof BOT_LEVELS[number];
export const isBotLevel = (value: unknown): value is BotLevel =>
  BOT_LEVELS.some((level) => level === value);
export const WEAPONS = [
  {
    name: 'Bazooka',
    icon: '🚀',
    cd: 4,
    ammo: -1,
    damage: 38,
    radius: 64,
    metal: true,
    desc: "Vise, maintiens le clic pour régler la puissance, puis relâche. Explosion dangereuse de près.",
  },
  {
    name: 'Grenade',
    icon: '💣',
    cd: 4,
    ammo: -1,
    damage: 45,
    radius: 78,
    metal: true,
    desc: "Maintiens puis relâche pour lancer. F règle le retardement de 1 à 4 s. Attention aux rebonds.",
  },
  {
    name: 'Fusil à bouchons',
    icon: '🔫',
    cd: 3,
    ammo: -1,
    damage: 11,
    radius: 12,
    metal: false,
    desc: "Vise puis clique. Trois bouchons, portée fixe de 350 px : approche-toi.",
  },
  {
    name: 'Gant à ressort',
    icon: '🥊',
    cd: 4,
    ammo: -1,
    damage: 20,
    radius: 15,
    metal: false,
    desc: "Approche à moins de 88 px, vise l’adversaire puis clique. Le coup part après 0,3 s.",
  },
  {
    name: 'Taupe foreuse',
    icon: '🛠',
    cd: 6,
    ammo: 2,
    damage: 34,
    radius: 66,
    metal: true,
    desc: "Vise un mur puis clique. La taupe avance tout droit et fore au maximum 145 px.",
  },
  {
    name: 'Pigeon téléguidé',
    icon: '🐦',
    cd: 7,
    ammo: 1,
    damage: 42,
    radius: 75,
    metal: false,
    desc: "Clique pour lancer, puis guide le pigeon avec la souris. E rend le contrôle au pirate. Destructible.",
  },
  {
    name: 'Pot de pop-corn',
    icon: '🍿',
    cd: 7,
    ammo: 1,
    damage: 20,
    radius: 40,
    metal: false,
    desc: "Maintiens puis relâche pour lancer. Éclate en six petites bombes après 2 s. Caisse rare.",
  },
  {
    name: 'Mine sauteuse',
    icon: '💥',
    cd: 4,
    ammo: 2,
    damage: 34,
    radius: 65,
    metal: true,
    desc: "Vise le sol puis clique pour lancer la mine. Elle s’arme après 1,2 s. Deux actives maximum.",
  },
  {
    name: 'Bombe ventouse',
    icon: '🧨',
    cd: 5,
    ammo: 2,
    damage: 36,
    radius: 65,
    metal: true,
    desc: "Maintiens puis relâche pour lancer. Colle 2,8 s avant explosion ; E pour la décrocher de soi.",
  },
  {
    name: 'Canon à mousse',
    icon: '🫧',
    cd: 5,
    ammo: 2,
    damage: 0,
    radius: 47,
    metal: false,
    desc: "Vise près de toi, puis clique quand le cercle est vert. Chevauche le bord du sol pour créer un pont. Dure 12 s.",
  },
  {
    name: 'Aimant de poche',
    icon: '🧲',
    cd: 6,
    ammo: 2,
    damage: 0,
    radius: 180,
    metal: false,
    desc: "Clique pour activer le champ autour de toi pendant 3 s. Il attire les projectiles métalliques.",
  },
  {
    name: 'Frigo parachuté',
    icon: '🧊',
    cd: 8,
    ammo: 1,
    damage: 65,
    radius: 105,
    metal: true,
    desc: "Vise un emplacement vert puis clique. Le frigo tombe du ciel : attention au délai ! Caisse rare.",
  },
  {
    name: 'Grappin',
    icon: '⚓',
    cd: 0.5,
    ammo: -1,
    damage: 0,
    radius: 0,
    metal: false,
    desc: "Vise un morceau de terrain à moins de 380 px puis clique. Gauche/droite pour te balancer, E pour lâcher.",
  },
  {
    name: 'Jetpack poussif',
    icon: '🔥',
    cd: 1,
    ammo: 1,
    damage: 0,
    radius: 0,
    metal: false,
    desc: "Clique pour décoller. Gauche/droite pour diriger, E pour couper. Trois secondes de carburant.",
  },
  {
    name: 'Téléporteur',
    icon: '🌀',
    cd: 5,
    ammo: 1,
    damage: 0,
    radius: 0,
    metal: false,
    desc: "Vise une destination verte puis clique. Attends 1,2 s ; les dégâts annulent la téléportation.",
  },
];
WEAPONS.push(
  { name: 'Éclair', icon: '⚡', cd: 8, ammo: 1, damage: 12, radius: 0, metal: false,
    desc: 'Frappe tous les adversaires pour 12 dégâts. Une charge, en caisse uniquement.' },
  { name: 'Glue', icon: '🧴', cd: 5, ammo: 2, damage: 0, radius: 45, metal: false,
    desc: 'Vise, arme puis tire à la puissance choisie. Immobilise 3 secondes sans bloquer le tir. Ne cumule pas les durées.' },
  { name: "Bombe feu d’artifice", icon: '🎆', cd: 6, ammo: 2, damage: 12, radius: 30, metal: false,
    desc: 'Vise et règle la puissance. Éclate après 0,75 s en 18 fragments descendants. Attention aux retombées, même sur toi !' },
);
export type Input = {
  move: number;
  jump: boolean;
  angle: number;
  tx: number;
  ty: number;
  weapon: number;
  fire: boolean;
  power: number;
  fuse: number;
  action: boolean;
  seq: number;
};
export const blankInput = (): Input => ({
  move: 0,
  jump: false,
  angle: -0.6,
  tx: 0,
  ty: 0,
  weapon: 0,
  fire: false,
  power: 0.65,
  fuse: 2,
  action: false,
  seq: 0,
});
export type Stats = {
  kills: number;
  damage: number;
  taken: number;
  self: number;
  shots: number;
  hits: number;
  projection: number;
  water: number;
  terrain: number;
  crates: number;
  survival: number;
  byWeapon: number[];
};
export type Player = {
  id: string;
  name: string;
  color: string;
  bot: boolean;
  glued: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  alive: boolean;
  ground: boolean;
  coyote: number;
  jumpBuffer: number;
  prevJump: boolean;
  cd: number;
  weapon: number;
  ammo: number[];
  angle: number;
  input: Input;
  stats: Stats;
  rope: null | { x: number; y: number; length: number };
  jet: number;
  magnet: number;
  teleport: null | { x: number; y: number; time: number };
  punch: null | { time: number; angle: number; attack: number };
  pilot: number;
  flight: null | { owner: string; x: number; y: number; attack: number };
  lastHit: number;
  landed: number;
  botTime: number;
  disconnected: number;
};
export type Shot = {
  originWeapon?:number;
  id: number;
  attack: number;
  owner: string;
  weapon: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  travel: number;
  drill: number;
  stuck: boolean;
  target?: string;
  armed: boolean;
  hp: number;
};
export type TerrainEvent = {
  seq: number;
  x: number;
  y: number;
  r: number;
  fill: boolean;
  foam?: boolean;
};
export type Effect = {
  id: number;
  type: string;
  x: number;
  y: number;
  r: number;
  text?: string;
  color?: string;
};
export type Snapshot = {
  map: TerrainId;
  seed: number;
  tick: number;
  time: number;
  water: number;
  players: Player[];
  shots: Shot[];
  crates: { x: number; y: number; weapon: number }[];
  foams: { x: number; y: number; r: number; until: number }[];
  events: TerrainEvent[];
  effects: Effect[];
  done: boolean;
  winner: string | null;
  training: boolean;
  nextCrate: { x: number; at: number };
  terrain?: number[];
};
export class World {
  seed: number;
  tick = 0;
  time = 0;
  water = 890;
  terrain: Uint8Array = new Uint8Array(COLS * ROWS);
  players: Player[] = [];
  shots: Shot[] = [];
  crates: Snapshot['crates'] = [];
  foams: Snapshot['foams'] = [];
  events: TerrainEvent[] = [];
  effects: Effect[] = [];
  done = false;
  winner: string | null = null;
  training = false;
  botLevel: BotLevel = 'normal';
  nextCrate = { x: 900, at: 14 };
  private serial = 0;
  private rng: number;
  private hits = new Set<string>();
  constructor(seed = Date.now() % 1000000, training = false, public map: TerrainId = 'pirate') {
    this.seed = seed;
    this.rng = seed || 1;
    this.training = training;
    this.generate();
    this.nextCrate.x = 300 + this.random() * 1200;
  }
  random() {
    this.rng = (Math.imul(1664525, this.rng) + 1013904223) >>> 0;
    return this.rng / 4294967296;
  }
  generate() {
    generateTerrain(this.terrain, COLS, CELL, this.map, this.seed);
    this.events = [];
  }
  solid(x: number, y: number) {
    if (x < 0 || x >= W) return true;
    if (y < 0 || y >= H) return false;
    return (
      !!this.terrain[Math.floor(y / CELL) * COLS + Math.floor(x / CELL)] ||
      this.foams.some((f) => Math.hypot(x - f.x, y - f.y) < f.r)
    );
  }
  body(x: number, y: number) {
    // Rounded collision body, sampled more finely than a terrain cell.
    for (let dy = -18; dy <= 18; dy += 3) {
      const half = Math.abs(dy) > 12 ? 6 : 9;
      for (let dx = -half; dx <= half; dx += 3)
        if (this.solid(x + dx, y + dy)) return true;
    }
    return false;
  }
  surface(x: number) {
    for (let y = 30; y < 880; y += CELL) if (this.solid(x, y)) return y;
    return 850;
  }
  circle(x: number, y: number, r: number, fill = false, record = true) {
    let n = 0;
    for (
      let yy = Math.max(0, Math.floor((y - r) / CELL));
      yy < Math.min(ROWS, Math.ceil((y + r) / CELL));
      yy++
    )
      for (
        let xx = Math.max(0, Math.floor((x - r) / CELL));
        xx < Math.min(COLS, Math.ceil((x + r) / CELL));
        xx++
      ) {
        if ((xx * CELL - x) ** 2 + (yy * CELL - y) ** 2 <= r * r) {
          const i = yy * COLS + xx;
          if (this.terrain[i] && !fill) n++;
          this.terrain[i] = fill ? 1 : 0;
        }
      }
    if (record)
      this.events.push({ seq: this.events.length + 1, x, y, r, fill });
    return n * CELL * CELL;
  }
  addPlayer(id: string, name: string, bot = false, specials = [4, 8]) {
    if (this.players.length >= 6) throw Error('Salon complet');
    const i = this.players.length,
      x = [220, 1580, 650, 1150, 440, 1370][i];
    const ammo = WEAPONS.map(() => 0);
    const selected = [...new Set(specials.filter((w) => SPECIALS.includes(w)))].slice(0, 2);
    for (const slot of specials.slice(0, 2)) {
      if (slot !== -1 || selected.length >= 2) continue;
      const pool = SPECIALS.filter((w) => !selected.includes(w));
      selected.push(pool[Math.floor(this.random() * pool.length)]);
    }
    [
      0,
      1,
      2,
      3,
      12,
      ...selected,
    ].forEach((w) => (ammo[w] = WEAPONS[w].ammo));
    if (this.training) ammo.fill(-1);
    const p: Player = {
      id,
      name: name.slice(0, 18) || 'Moussaillon',
      color: COLORS[i],
      bot,
      glued: 0,
      x,
      y: this.surface(x) - 25,
      vx: 0,
      vy: 0,
      hp: 100,
      alive: true,
      ground: false,
      coyote: 0,
      jumpBuffer: 0,
      prevJump: false,
      cd: 0,
      weapon: 0,
      ammo,
      angle: -0.6,
      input: blankInput(),
      stats: {
        kills: 0,
        damage: 0,
        taken: 0,
        self: 0,
        shots: 0,
        hits: 0,
        projection: 0,
        water: 0,
        terrain: 0,
        crates: 0,
        survival: 0,
        byWeapon: WEAPONS.map(() => 0),
      },
      rope: null,
      jet: 0,
      magnet: 0,
      teleport: null,
      punch: null,
      pilot: 0,
      flight: null,
      lastHit: -100,
      landed: 0,
      botTime: (bot && this.botLevel === 'easy' ? 6 : 1) + this.random() * 2,
      disconnected: 0,
    };
    this.players.push(p);
    return p;
  }
  command(id: string, raw: Partial<Input>) {
    const p = this.players.find((p) => p.id === id);
    if (
      !p ||
      !p.alive ||
      !raw ||
      !Number.isFinite(raw.seq) ||
      raw.seq! <= p.input.seq
    )
      return;
    const number = (v: unknown, d: number, min: number, max: number) =>
      typeof v === 'number' && Number.isFinite(v)
        ? Math.max(min, Math.min(max, v))
        : d;
    p.input = {
      move: number(raw.move, 0, -1, 1),
      jump: raw.jump === true,
      angle: number(raw.angle, p.angle, -Math.PI, Math.PI),
      tx: number(raw.tx, p.x, 0, W),
      ty: number(raw.ty, p.y, 0, H),
      weapon: Math.floor(number(raw.weapon, p.weapon, 0, WEAPONS.length - 1)),
      fire: p.input.fire || raw.fire === true,
      power: number(raw.power, 0.5, 0, 1),
      fuse: number(raw.fuse, 2, 1, 4),
      action: p.input.action || raw.action === true,
      seq: raw.seq!,
    };
  }
  effect(
    type: string,
    x: number,
    y: number,
    r = 0,
    text?: string,
    color?: string,
  ) {
    this.effects.push({ id: ++this.serial, type, x, y, r, text, color });
    if (this.effects.length > 90) this.effects.shift();
  }
  validTarget(p: Player, x: number, y: number, range: number, r = 18) {
    return (
      x > r &&
      x < W - r &&
      y > r &&
      y < this.water - r &&
      Math.hypot(x - p.x, y - p.y) <= range &&
      !this.body(x, y) &&
      !this.players.some(
        (q) => q.alive && Math.hypot(q.x - x, q.y - y) < r + 20,
      )
    );
  }
  fire(p: Player) {
    const w = p.input.weapon;
    if (p.glued > 0 && [12, 13, 14].includes(w)) return;
    if (
      p.cd > 0 ||
      p.pilot ||
      p.teleport ||
      p.punch ||
      p.jet > 0 ||
      p.rope ||
      p.ammo[w] === 0
    )
      return;
    const def = WEAPONS[w];
    const tx = p.input.tx,
      ty = p.input.ty;
    if([9,11,14].includes(w)){
      const advice=placementAdvice(p,w,tx,ty,this.players,this.water,(x,y)=>this.solid(x,y));
      if(!advice.ok){this.effect('refused',p.x,p.y-65,0,advice.text,'#ffb096');return;}
    }
    if (
      w === 7 &&
      this.shots.filter((s) => s.owner === p.id && s.weapon === 7).length >= 2
    )
      return;
    if (w === 12) {
      for (let d = 22; d <= 380; d += 4) {
        const x = p.x + Math.cos(p.angle) * d,
          y = p.y + Math.sin(p.angle) * d;
        if (this.solid(x, y)) {
          p.rope = { x, y, length: d };
          p.cd = 0.5;
          this.effect('rope', x, y, 10);
          return;
        }
      }
      return;
    }
    p.cd = def.cd;
    if (p.ammo[w] > 0) p.ammo[w]--;
    const attack = ++this.serial;
    if (w < 9 || w === 11 || w >= 15) p.stats.shots++;
    if (w === 15) {
      for (const target of this.players) {
        if (!target.alive || target.id === p.id) continue;
        this.effect('lightning', target.x, target.y, 30, 'ÉCLAIR !', '#a9eeff');
        this.hit(target, p.id, 12, w, attack, 0, 0);
      }
      return;
    }
    this.effect('fire', p.x, p.y, 15, undefined, p.color);
    if (w === 9) {
      this.foams.push({ x: tx, y: ty, r: 47, until: this.time + 12 });
      return;
    }
    if (w === 10) {
      p.magnet = 3;
      return;
    }
    if (w === 13) {
      p.jet = 3;
      return;
    }
    if (w === 14) {
      p.teleport = { x: tx, y: ty, time: 1.2 };
      return;
    }
    if (w === 3) {
      p.punch = { time: 0.3, angle: p.angle, attack };
      return;
    }
    const speed =
      w === 4
        ? 180
        : w === 5
          ? 240
          : w === 8
            ? 160 + p.input.power * 270
            : w === 2
              ? 600
              : w === 7
                ? 180
                : 240 + p.input.power * 490;
    const spawn = (a: number) => {
      const s: Shot = {
        id: ++this.serial,
        attack,
        owner: p.id,
        weapon: w,
        originWeapon:w,
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life:
          w === 1
            ? p.input.fuse
            : w === 6
              ? 2
              : w === 8
                ? 2.8
                : w === 7
                  ? 40
                  : w === 5
                    ? 5
                    : 8,
        age: 0,
        travel: 0,
        drill: 0,
        stuck: false,
        armed: false,
        hp: w === 5 ? 15 : 8,
      };
      if (w === 11) {
        s.x = tx;
        s.y = -100;
        s.vx = 0;
        s.vy = 65;
        s.life = 15;
        this.effect('warning', tx, ty, 105, 'LIVRAISON !');
      }
      if (w === 17) {
        s.life = 0.75;
      }
      if (w !== 11) {
        for (let d = 0; d < 22; d += 2) {
          const mx = p.x + Math.cos(a) * d,
            my = p.y + Math.sin(a) * d;
          if (this.solid(mx, my)) {
            s.x = mx;
            s.y = my;
            s.life = 0;
            break;
          }
        }
      }
      this.shots.push(s);
      if (w === 5) p.pilot = s.id;
      return s;
    };
    if (w === 2) {
      for (const da of [-0.12, 0, 0.12]) spawn(p.angle + da);
    } else spawn(p.angle);
  }
  hit(
    p: Player,
    owner: string,
    damage: number,
    weapon: number,
    attack: number,
    kx: number,
    ky: number,
  ) {
    if (!p.alive) return;
    const source = this.players.find((q) => q.id === owner);
    const dealt = Math.min(p.hp, Math.max(0, damage));
    p.hp -= dealt;
    p.stats.taken += dealt;
    p.teleport = null;
    p.lastHit = this.time;
    const scale = p.flight?.owner === owner ? 0.7 : 1;
    p.vx += kx * scale;
    p.vy += ky * scale;
    p.ground = false;
    if (owner === p.id) p.stats.self += dealt;
    else if (source) {
      source.stats.damage += dealt;
      source.stats.byWeapon[weapon] += dealt;
      const key = owner + ':' + attack;
      if (!this.hits.has(key)) {
        this.hits.add(key);
        source.stats.hits++;
      }
      if (Math.hypot(kx, ky) > 50) p.flight = { owner, x: p.x, y: p.y, attack };
    }
    this.effect('damage', p.x, p.y - 30, 0, String(Math.round(dealt)), p.color);
    if (p.hp <= 0) this.kill(p, source?.id, false);
  }
  kill(p: Player, owner?: string, water = false) {
    if (!p.alive) return;
    if (this.training) {
      p.hp = 100;
      p.x = p.bot ? 700 : 220;
      p.y = this.surface(p.x) - 30;
      p.vx = p.vy = 0;
      p.flight = null;
      return;
    }
    p.alive = false;
    p.hp = 0;
    p.stats.survival = this.time;
    p.rope = null;
    p.jet = 0;
    const source = this.players.find((q) => q.id === owner && q.id !== p.id);
    if (source) {
      source.stats.kills++;
      if (water) source.stats.water++;
    }
    this.effect(
      'death',
      p.x,
      Math.min(p.y, this.water),
      55,
      water ? 'PLOUF !' : 'BOUM !',
      p.color,
    );
  }
  explode(s: Shot) {
    if (s.weapon === 16) {
      this.effect('glue', s.x, s.y, 45, 'GLUE', '#94ef76');
      for (const target of this.players) {
        if (!target.alive || Math.hypot(target.x - s.x, target.y - s.y) > 65) continue;
        if (target.glued <= 0) {
          target.glued = 3;
          if (!target.flight) target.vx = 0;
        }
        target.rope = null;
        target.jet = 0;
        target.teleport = null;
        target.jumpBuffer = 0;
        if (target.id !== s.owner) {
          const key = s.owner + ':' + s.attack;
          if (!this.hits.has(key)) {
            this.hits.add(key);
            const source = this.players.find((p) => p.id === s.owner);
            if (source) source.stats.hits++;
          }
        }
      }
      return;
    }
    if (s.weapon === 17) {
      this.effect('explosion', s.x, s.y, 35, undefined, '#ff83dc');
      for (let n = 0; n < 18 && this.shots.length < 100; n++)
        this.shots.push({ ...s, id: ++this.serial, weapon: 0, originWeapon: 17,
          vx: (n - 8.5) * 32, vy: 80 + (n % 3) * 55,
          life: 3, age: 0, travel: 0, hp: 8 });
      return;
    }
    if (s.originWeapon === 17) {
      const original = s.weapon;
      s.weapon = 17;
      // Fragments use firework damage without spawning another generation.
      this.explodeFragment(s);
      s.weapon = original;
      return;
    }
    this.explodeFragment(s);
  }
  explodeFragment(s: Shot) {
    const d = s.originWeapon===6&&s.weapon===1?{...WEAPONS[1],damage:20,radius:38}:WEAPONS[s.weapon],
      r = d.radius;
    const owner = this.players.find((p) => p.id === s.owner);
    const removed = this.circle(s.x, s.y, r);
    if (owner) owner.stats.terrain += removed;
    this.foams = this.foams.filter(
      (f) => Math.hypot(s.x - f.x, s.y - f.y) > r + f.r,
    );
    this.effect(
      'explosion',
      s.x,
      s.y,
      r,
      undefined,
      s.weapon === 2 ? '#fff0ab' : '#ffb12e',
    );
    for (const p of this.players) {
      const dx = p.x - s.x,
        dy = p.y - s.y,
        dist = Math.hypot(dx, dy);
      if (p.alive && dist < r + 20) {
        const force = 1 - dist / (r + 20);
        this.hit(
          p,
          s.owner,
          d.damage * (0.35 + 0.65 * force),
          s.originWeapon??s.weapon,
          s.attack,
          (dx / Math.max(1, dist)) * 430 * force,
          (dy / Math.max(1, dist)) * 330 * force - 150 * force,
        );
      }
    }
    for (const q of this.shots) {
      if (q.id !== s.id && Math.hypot(q.x - s.x, q.y - s.y) < r) {
        q.hp -= d.damage;
        if (q.hp <= 0) q.life = 0;
      }
    }
    if (s.weapon === 6 && this.shots.length < 100) {
      for (let i = 0; i < 6; i++)
        this.shots.push({
          ...s,
          id: ++this.serial,
          weapon: 1,
          vx: (this.random() - 0.5) * 430,
          vy: -130 - this.random() * 220,
          life: 0.7 + this.random(),
          age: 0,
          stuck: false,
          target: undefined,
          hp: 8,
        });
    }
  }
  move(p: Player, dt: number) {
    const i = p.input;
    const glued = p.glued > 0;
    p.glued = Math.max(0, p.glued - dt);
    if (glued) { p.jumpBuffer = 0; p.rope = null; p.jet = 0; p.teleport = null; }
    if (this.body(p.x, p.y)) {
      for (let lift = 1; lift <= 16; lift++) {
        if (!this.body(p.x, p.y - lift)) {
          p.y -= lift;
          break;
        }
      }
    }
    p.angle = i.angle;
    if (p.ammo[i.weapon] !== 0) p.weapon = i.weapon;
    p.cd = Math.max(0, p.cd - dt);
    p.magnet = Math.max(0, p.magnet - dt);
    p.coyote = p.ground ? 0.11 : Math.max(0, p.coyote - dt);
    if (!glued && i.jump && !p.prevJump) p.jumpBuffer = 0.12;
    p.prevJump = i.jump;
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = -400;
      p.ground = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      this.effect('jump', p.x, p.y + 17, 15);
    }
    if (i.action) {
      p.rope = null;
      p.jet = 0;
      p.pilot = 0;
      for (const s of this.shots)
        if (s.target === p.id) {
          s.target = undefined;
          s.stuck = false;
          s.vx = Math.cos(p.angle) * 180;
          s.vy = -150;
          s.x = p.x + Math.cos(p.angle) * 28;
          s.y = p.y - 10;
          s.age = 0;
        }
    }
    i.action = false;
    if (p.teleport) {
      p.teleport.time -= dt;
      if (p.teleport.time <= 0) {
        const t = p.teleport;
        if (this.validTarget(p, t.x, t.y, Number.POSITIVE_INFINITY)) {
          this.effect('teleport', p.x, p.y, 45);
          p.x = t.x;
          p.y = t.y;
          p.vx = p.vy = 0;
          this.effect('teleport', p.x, p.y, 45);
        }
        p.teleport = null;
      }
    }
    if (p.punch) {
      p.punch.time -= dt;
      if (p.punch.time <= 0) {
        for (const q of this.players)
          if (
            q.id !== p.id &&
            q.alive &&
            Math.hypot(q.x - p.x, q.y - p.y) < 88 &&
            Math.cos(p.punch.angle) * (q.x - p.x) > -10
          )
            this.hit(
              q,
              p.id,
              20,
              3,
              p.punch.attack,
              Math.cos(p.punch.angle) * 670,
              -340,
            );
        this.effect('punch', p.x + Math.cos(p.punch.angle) * 45, p.y, 40);
        p.punch = null;
      }
    }
    if (p.pilot && !this.shots.some((s) => s.id === p.pilot)) p.pilot = 0;
    const locked = !!(p.pilot || p.teleport || p.punch);
    if (!locked && !glued)
      p.vx += (i.move * 205 - p.vx) * Math.min(1, dt * (p.ground ? 14 : 7));
    else if (!glued) p.vx *= 0.75;
    p.vy += 610 * dt;
    if (p.jet > 0) {
      p.jet -= dt;
      p.vy = Math.max(-200, p.vy - 1100 * dt);
      if (this.tick % 3 === 0) this.effect('jet', p.x, p.y + 20, 15);
    }
    const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(p.vx * dt), Math.abs(p.vy * dt)) / 3),
    );
    p.ground = false;
    for (let n = 0; n < steps; n++) {
      const dx = (p.vx * dt) / steps,
        dy = (p.vy * dt) / steps;
      if (!this.body(p.x + dx, p.y)) p.x += dx;
      else {
        let stepped = false;
        if (Math.abs(dx) > 0 && p.vy >= 0)
          for (let up = 2; up <= 14; up += 2)
            if (!this.body(p.x + dx, p.y - up)) {
              p.x += dx;
              p.y -= up;
              stepped = true;
              break;
            }
        if (!stepped) p.vx = 0;
      }
      if (!this.body(p.x, p.y + dy)) p.y += dy;
      else {
        if (dy >= 0) p.ground = true;
        p.vy = 0;
      }
    }
    p.x = Math.max(16, Math.min(W - 16, p.x));
    if (p.rope) {
      if (!this.solid(p.rope.x, p.rope.y)) p.rope = null;
      else {
        const dx = p.x - p.rope.x,
          dy = p.y - p.rope.y,
          d = Math.hypot(dx, dy);
        if (d > p.rope.length) {
          const x = p.rope.x + (dx / d) * p.rope.length,
            y = p.rope.y + (dy / d) * p.rope.length;
          if (!this.body(x, y)) {
            p.x = x;
            p.y = y;
            const radial = (p.vx * dx + p.vy * dy) / (d * d);
            p.vx -= radial * dx;
            p.vy -= radial * dy;
          }
        }
      }
    }
    if (p.flight) {
      const source = this.players.find((q) => q.id === p.flight!.owner);
      if (source)
        source.stats.projection = Math.max(
          source.stats.projection,
          Math.hypot(p.x - p.flight.x, p.y - p.flight.y),
        );
      p.landed = p.ground ? p.landed + dt : 0;
      if (p.landed > 0.18) {
        p.flight = null;
        p.landed = 0;
      }
    }
    if (p.y + 10 >= this.water) {
      if (this.training) {
        p.x = 220;
        p.y = this.surface(220) - 30;
        p.vx = p.vy = 0;
        p.hp = 100;
      } else this.kill(p, p.flight?.owner, true);
    }
    if (i.fire) this.fire(p);
    i.fire = false;
  }
  bot(p: Player, dt: number) {
    if (this.training) return;
    const targets = this.players.filter((q) => q.alive && q.id !== p.id);
    if (!targets.length) return;
    const t = targets.sort(
        (a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x),
      )[0],
      dx = t.x - p.x,
      dy = t.y - p.y;
    p.botTime -= dt;
    const easy = this.botLevel === 'easy';
    if (easy && this.tick % 18 !== 0) {
      p.input.jump = false;
      return;
    }
    const danger = this.shots.some(
      (s) => s.owner !== p.id && Math.hypot(s.x - p.x, s.y - p.y) < 110,
    );
    p.input.move =
      Math.abs(dx) > 430 ? Math.sign(dx) : danger ? -Math.sign(dx) : 0;
    p.input.jump = easy ? this.tick % 180 === 0 : this.tick % 65 < 2 || danger;
    p.input.angle = Math.atan2(dy - Math.abs(dx) * 0.42, dx);
    p.input.tx = t.x;
    p.input.ty = t.y;
    p.input.power = Math.min(1, Math.abs(dx) / 700 + 0.18);
    p.input.weapon = 0;
    if (p.botTime <= 0 && p.cd <= 0) {
      const settings = {
        easy: { error: 0.85, delay: 10 }, normal: { error: 0.15, delay: 4 },
        hard: { error: 0.08, delay: 1.5 }, expert: { error: 0.025, delay: 0.5 },
      }[this.botLevel];
      if (this.botLevel === 'hard' || this.botLevel === 'expert') {
        const speed = 240 + p.input.power * 490;
        const distance = Math.abs(dx);
        const lead = this.botLevel === 'expert' ? t.vx * distance / speed : 0;
        const aimedX = dx + lead;
        const discriminant = speed ** 4 - 480 * (480 * aimedX ** 2 - 2 * dy * speed ** 2);
        if (discriminant >= 0 && Math.abs(aimedX) > 1) {
          const elevation = Math.atan((speed ** 2 - Math.sqrt(discriminant)) / (480 * Math.abs(aimedX)));
          p.input.angle = aimedX > 0 ? -elevation : -Math.PI + elevation;
        }
      }
      p.input.angle += (this.random() - 0.5) * settings.error;
      if (easy) p.input.power = Math.max(0.15, Math.min(1, p.input.power + (this.random() - 0.5) * 0.6));
      p.input.fire = true;
      p.botTime = settings.delay + this.random() * 2;
    }
  }
  step(dt = DT) {
    if (this.done) return;
    this.time += dt;
    this.tick++;
    if (!this.training && this.time > 120)
      this.water = Math.max(200, 890 - (this.time - 120) * 3.5);
    this.foams = this.foams.filter((f) => f.until > this.time);
    for (const p of this.players) {
      if (!p.alive) continue;
      if (p.disconnected && this.time - p.disconnected > 15) {
        this.kill(p);
        continue;
      }
      if (p.bot) this.bot(p, dt);
      this.move(p, dt);
      p.stats.survival = this.time;
    }
    for (const s of [...this.shots]) {
      s.age += dt;
      s.life -= dt;
      const owner = this.players.find((p) => p.id === s.owner);
      if (s.target) {
        const q = this.players.find((p) => p.id === s.target && p.alive);
        if (q) {
          s.x = q.x;
          s.y = q.y;
        } else {
          s.target = undefined;
          s.stuck = false;
        }
      }
      if (s.weapon === 5 && owner?.pilot === s.id) {
        const desired = Math.atan2(owner.input.ty - s.y, owner.input.tx - s.x);
        const current = Math.atan2(s.vy, s.vx);
        const delta = Math.atan2(
          Math.sin(desired - current),
          Math.cos(desired - current),
        );
        const angle = current + Math.max(-5 * dt, Math.min(5 * dt, delta));
        s.vx = Math.cos(angle) * 240;
        s.vy = Math.sin(angle) * 240;
      }
      if (
        s.weapon === 7 &&
        s.age > 1.2 &&
        !s.armed &&
        this.players.some(
          (p) =>
            p.alive &&
            p.id !== s.owner &&
            Math.hypot(p.x - s.x, p.y - s.y) < 85,
        )
      ) {
        s.armed = true;
        s.stuck = false;
        s.vy = -260;
        s.life = 0.5;
      }
      if (
        s.stuck &&
        !s.target &&
        !this.solid(s.x, s.y + 5) &&
        ![8].includes(s.weapon)
      )
        s.stuck = false;
      if (!s.stuck) {
        for (const p of this.players)
          if (p.alive && p.magnet > 0 && WEAPONS[s.weapon].metal) {
            const dx = p.x - s.x,
              dy = p.y - s.y,
              d = Math.hypot(dx, dy);
            if (d < 180) {
              s.vx += dx * 3 * dt;
              s.vy += dy * 3 * dt;
            }
          }
        if (![4, 5, 11].includes(s.weapon)) s.vy += 480 * dt;
        if (s.weapon === 11) s.vy = Math.min(360, s.vy + 100 * dt);
        const steps = Math.max(1, Math.ceil((Math.hypot(s.vx, s.vy) * dt) / 3));
        for (let n = 0; n < steps; n++) {
          const nx = s.x + (s.vx * dt) / steps,
            ny = s.y + (s.vy * dt) / steps,
            solid = this.solid(nx, ny);
          s.travel += (Math.hypot(s.vx, s.vy) * dt) / steps;
          if (solid && s.weapon === 4) {
            s.drill += (Math.hypot(s.vx, s.vy) * dt) / steps;
            if (s.drill > 145) {
              s.life = 0;
              break;
            }
          } else if (solid) {
            if ([1, 6, 7].includes(s.weapon)) {
              if (this.solid(nx, s.y)) s.vx *= -0.55;
              if (this.solid(s.x, ny)) s.vy *= -0.5;
              s.vx *= 0.85;
              if (Math.abs(s.vy) < 22) {
                s.vy = 0;
                s.stuck = true;
              }
              break;
            } else if (s.weapon === 8) {
              s.stuck = true;
              s.vx = s.vy = 0;
              break;
            } else {
              s.life = 0;
              break;
            }
          }
          s.x = nx;
          s.y = ny;
          const target = this.players.find(
            (p) =>
              p.alive &&
              (p.id !== s.owner || s.age > 0.35) &&
              Math.hypot(p.x - s.x, p.y - s.y) < 17,
          );
          if (target) {
            if (s.weapon === 8 && s.age > 0.25) {
              s.target = target.id;
              s.stuck = true;
              break;
            }
            if (![1, 6, 7, 8].includes(s.weapon)) {
              s.life = 0;
              break;
            }
          }
          if (s.weapon === 2) {
            for (const q of this.shots)
              if (
                q.id !== s.id &&
                [5, 7].includes(q.weapon) &&
                Math.hypot(q.x - s.x, q.y - s.y) < 15
              ) {
                q.hp -= 11;
                if (q.hp <= 0) q.life = 0;
                s.life = 0;
                break;
              }
          }
        }
      }
      if (s.weapon === 2 && s.travel > 350) s.life = 0;
      if (s.weapon === 4 && s.travel > 550) s.life = 0;
      if (s.y > this.water || s.x < 0 || s.x > W) {
        this.shots = this.shots.filter((q) => q.id !== s.id);
        continue;
      }
      if (s.life <= 0) {
        this.shots = this.shots.filter((q) => q.id !== s.id);
        this.explode(s);
      }
    }
    if (this.time >= this.nextCrate.at) {
      if (this.crates.length < 4) {
        const weapon = [4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17][
          Math.floor(this.random() * 13)
        ];
        this.crates.push({ x: this.nextCrate.x, y: 50, weapon });
        this.effect('crate', this.nextCrate.x, 70, 20, 'DU BUTIN !');
      }
      this.nextCrate = { x: 180 + this.random() * 1440, at: this.time + 18 };
    }
    for (const c of this.crates) {
      if (!this.solid(c.x, c.y + 15)) c.y += 110 * dt;
      const p = this.players.find(
        (p) => p.alive && Math.hypot(p.x - c.x, p.y - c.y) < 33,
      );
      if (p) {
        p.stats.crates++;
        if (p.ammo[c.weapon] >= 0)
          p.ammo[c.weapon] = Math.min(3, p.ammo[c.weapon] + 1);
        this.effect('pickup', p.x, p.y - 40, 0, WEAPONS[c.weapon].name);
        c.y = H + 100;
      }
    }
    this.crates = this.crates.filter((c) => c.y < this.water);
    if (
      !this.training &&
      this.players.length >= 2 &&
      this.players.filter((p) => p.alive).length <= 1
    ) {
      this.done = true;
      this.winner = this.players.find((p) => p.alive)?.id ?? null;
    }
  }
  snapshot(full = false, since = 0): Snapshot {
    return {
      seed: this.seed,
      map: this.map,
      tick: this.tick,
      time: this.time,
      water: this.water,
      players: JSON.parse(JSON.stringify(this.players)),
      shots: this.shots.map((s) => ({ ...s })),
      crates: this.crates.map((c) => ({ ...c })),
      foams: this.foams.map((f) => ({ ...f })),
      events: this.events.filter((e) => e.seq > since),
      effects: this.effects.slice(-25),
      done: this.done,
      winner: this.winner,
      training: this.training,
      nextCrate: { ...this.nextCrate },
      ...(full ? { terrain: Array.from(this.terrain) } : {}),
    };
  }
}
export function awards(players: Player[], winner: string | null) {
  const specs: [string, (p: Player) => number, string][] = [
    ['Programme spatial', (p) => Math.round(p.stats.projection), 'px'],
    ['Architecte du néant', (p) => p.stats.terrain, 'px²'],
    ['Maître-nageur douteux', (p) => p.stats.water, 'plouf'],
    [
      'Compas dans l’œil',
      (p) =>
        p.stats.shots >= 5
          ? Math.round((p.stats.hits / p.stats.shots) * 100)
          : 0,
      '%',
    ],
    ['Mon pire ennemi', (p) => Math.round(p.stats.self), 'dégâts'],
    ['Livraison express', (p) => p.stats.crates, 'caisses'],
  ];
  const result: { title: string; names: string; value: string }[] = [];
  const w = players.find((p) => p.id === winner);
  if (w && w.hp < 10)
    result.push({
      title: 'Jusqu’au dernier pixel',
      names: w.name,
      value: Math.ceil(w.hp) + ' PV',
    });
  for (const [title, score, unit] of specs) {
    const max = Math.max(0, ...players.map(score));
    if (max > 0)
      result.push({
        title,
        names: players
          .filter((p) => score(p) === max)
          .map((p) => p.name)
          .join(' & '),
        value: max + ' ' + unit,
      });
    if (result.length >= 4) break;
  }
  return result;
}
export function placementAdvice(p:Player,weapon:number,x:number,y:number,players:Player[],water:number,solid:(x:number,y:number)=>boolean):{ok:boolean;text:string}{
 const range=weapon===9?230:weapon===14?450:650,r=weapon===9?47:18;
 if(Math.hypot(x-p.x,y-p.y)>range&&weapon!==11||weapon===11&&Math.abs(x-p.x)>range)return {ok:false,text:'Trop loin : rapproche le viseur de ton pirate'};
 if(x<r||x>W-r||y<r||y>water-r)return {ok:false,text:'Choisis un emplacement au-dessus de l’eau'};
 if(weapon===11){for(let cy=0;cy<y-20;cy+=4)if(solid(x,cy))return {ok:false,text:'Le passage depuis le ciel est bloqué'};return {ok:true,text:'Clic : larguer le frigo à cet endroit'}}
 if(players.some(q=>q.alive&&Math.hypot(q.x-x,q.y-y)<r+20))return {ok:false,text:'Trop près d’un pirate : décale le viseur'};
 if(weapon===9){let air=0;for(let a=0;a<12;a++)if(!solid(x+Math.cos(a*Math.PI/6)*40,y+Math.sin(a*Math.PI/6)*40))air++;if(!air)return {ok:false,text:'Entièrement dans le sol : vise le bord du terrain'};return {ok:true,text:'Clic : construire ici · La mousse tient 12 secondes'}}
 for(let dy=-18;dy<=18;dy+=3)for(let dx=-9;dx<=9;dx+=3)if(solid(x+dx,y+dy))return {ok:false,text:'Destination occupée par le terrain'};
 return {ok:true,text:'Clic : téléportation après 1,2 seconde'};
}

