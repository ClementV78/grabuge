import {
  World,
  W,
  H,
  COLS,
  ROWS,
  CELL,
  WEAPONS,
  POWER_WEAPONS,
  placementAdvice,
  type Player,
  type Snapshot,
} from './engine';
import { TERRAINS, type TerrainId } from './terrains';
export class Renderer {
  map: TerrainId = 'pirate';
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  terrain = document.createElement('canvas');
  tc: CanvasRenderingContext2D;
  bg = new Image();
  cam = { x: 900, y: 480, zoom: 1 };
  targetZoom = 1;
  lastTerrain = -1;
  lastSeed = -1;
  lastEffect = 0;
  particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    r: number;
    color: string;
    text?: string;
  }[] = [];
  width = 0;
  height = 0;
  shake = 0;
  shakeAmount = 0.5;
  seen = new Set<number>();
  onSound?: (type: string) => void;
  previous?: Snapshot;
  lastAt = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.terrain.width = W;
    this.terrain.height = H;
    this.tc = this.terrain.getContext('2d')!;
    this.bg.src = '/pirate-bg.png';
  }
  reset() {
    this.lastTerrain = -1;
    this.lastSeed = -1;
    this.seen.clear();
    this.particles = [];
  }
  screenToWorld(x: number, y: number) {
    return {
      x: (x - this.width / 2) / this.cam.zoom + this.cam.x,
      y: (y - this.height / 2) / this.cam.zoom + this.cam.y,
    };
  }
  rebuild(mask: Uint8Array, seed: number, region?:{x:number;y:number;r:number}) {
    const c = this.tc;
    const x0=region?Math.max(0,Math.floor((region.x-region.r-16)/CELL)):0;
    const y0=region?Math.max(0,Math.floor((region.y-region.r-16)/CELL)):0;
    const x1=region?Math.min(COLS,Math.ceil((region.x+region.r+16)/CELL)):COLS;
    const y1=region?Math.min(ROWS,Math.ceil((region.y+region.r+16)/CELL)):ROWS;
    const rw=x1-x0,rh=y1-y0;if(rw<=0||rh<=0)return;
    c.clearRect(x0*CELL,y0*CELL,rw*CELL,rh*CELL);
    const im = c.createImageData(rw,rh);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = y * COLS + x;
        if (!mask[i]) continue;
        const edge =
          !mask[i - COLS] || !mask[i - 1] || !mask[i + 1] || !mask[i + COLS];
        const top =
          !mask[i - COLS] || !mask[i - 2 * COLS] || !mask[i - 3 * COLS];
        const hash =
          (Math.imul(x + seed, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
        const noise = hash % 11;
        const pebble =
          (Math.floor(x / 3) * 13 + Math.floor(y / 3) * 37) % 97 < 3;
        const rgb = this.map === 'snow'
          ? (top ? [238, 249, 252] : edge ? [84, 147, 173] : [145 + noise, 200 + noise, 223 + noise])
          : this.map === 'canyon'
          ? (top ? [191 + noise, 187 + noise, 168 + noise] : edge ? [64, 66, 65] : [112 + noise + y % 9, 111 + noise + y % 9, 105 + noise])
          : top
          ? [221 + noise, 162 + noise, 70]
          : edge
            ? [60, 47, 38]
            : pebble
              ? [95 + noise, 68 + noise, 47]
              : [143 + noise, 91 + noise, 52];
        const j=(y-y0)*rw+x-x0;
        im.data[j * 4] = rgb[0];
        im.data[j * 4 + 1] = rgb[1];
        im.data[j * 4 + 2] = rgb[2];
        im.data[j * 4 + 3] = 255;
      }
    const tiny = document.createElement('canvas');
    tiny.width = rw;
    tiny.height = rh;
    tiny.getContext('2d')!.putImageData(im, 0, 0);
    c.imageSmoothingEnabled = true;
    c.drawImage(tiny, x0*CELL, y0*CELL, rw*CELL, rh*CELL);
    this.lastSeed = seed;
  }
  draw(
    s: Snapshot,
    mask: Uint8Array,
    id: string,
    dt: number,
    menu = false,
    overview = false,
    charge = 0,
  ) {
    const c = this.ctx,
      dpr = Math.min(2, devicePixelRatio || 1),
      width = this.canvas.clientWidth,
      height = this.canvas.clientHeight;
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, width, height);
    if (this.map !== s.map && s.map) {
      this.map = s.map;
      this.bg.src = TERRAINS[this.map].image;
      this.lastTerrain = -1;
    }
    if (this.bg.complete && this.bg.naturalWidth) {
      const scale = Math.max(width / this.bg.width, height / this.bg.height);
      c.drawImage(
        this.bg,
        (width - this.bg.width * scale) / 2,
        (height - this.bg.height * scale) / 2,
        this.bg.width * scale,
        this.bg.height * scale,
      );
    } else {
      c.fillStyle = '#248e98';
      c.fillRect(0, 0, width, height);
    }
    const p =
      s.players.find((p) => p.id === id && p.alive) ||
      s.players.find((p) => p.alive) ||
      s.players[0];
    const base = Math.min(width / 1250, height / 790);
    const zoom = menu
      ? Math.max(width / W, height / H)
      : overview
        ? Math.min(width / W, (height - 150) / H)
        : base * this.targetZoom;
    this.cam.zoom += (zoom - this.cam.zoom) * Math.min(1, dt * 7);
    const pilot = p?.pilot
      ? s.shots.find((shot) => shot.id === p.pilot)
      : undefined;
    const focus = pilot || p;
    const look = pilot ? pilot.vx * 0.2 : p ? Math.cos(p.angle) * 95 : 0;
    const tx = menu ? 900 : focus ? focus.x + look : 900,
      ty = menu ? 540 : focus ? focus.y - (pilot ? 0 : 100) : 500;
    const half = width / (2 * this.cam.zoom);
    this.cam.x +=
      (Math.max(
        Math.min(half, W / 2),
        Math.min(W - Math.min(half, W / 2), tx),
      ) -
        this.cam.x) *
      Math.min(1, dt * 7);
    this.cam.y += ((overview ? 500 : ty) - this.cam.y) * Math.min(1, dt * 5);
    if (menu) {
      this.cam.x = 900;
      this.cam.y = 540;
    }
    c.save();
    c.translate(
      width / 2 + (Math.random() - 0.5) * this.shake,
      height / 2 + (Math.random() - 0.5) * this.shake,
    );
    c.scale(this.cam.zoom, this.cam.zoom);
    c.translate(-this.cam.x, -this.cam.y);
    this.shake *= 0.84;
    if (this.lastSeed !== s.seed || this.lastTerrain<0) this.rebuild(mask,s.seed);
    else if(this.lastTerrain!==s.events.length)for(const e of s.events.slice(this.lastTerrain))this.rebuild(mask,s.seed,e);
    this.lastTerrain=s.events.length;
    c.drawImage(this.terrain, 0, 0);
    for (const f of s.foams) {
      c.fillStyle = '#91e6ce';
      c.strokeStyle = '#267777';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      for (let n = 0; n < 7; n++) {
        c.fillStyle = '#d9ffee';
        c.beginPath();
        c.arc(
          f.x + Math.cos(n * 2.3) * f.r * 0.6,
          f.y + Math.sin(n * 2.3) * f.r * 0.6,
          9,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    if (s.nextCrate.at - s.time < 4 && !menu) {
      this.text(
        '↓ BUTIN DANS ' + Math.ceil(s.nextCrate.at - s.time) + ' s',
        s.nextCrate.x,
        130,
        '#fff1a5',
        18,
      );
    }
    for (const box of s.crates) {
      c.save();
      c.translate(box.x, box.y);
      c.fillStyle = '#e9b14b';
      c.strokeStyle = '#412e25';
      c.lineWidth = 4;
      c.fillRect(-17, -16, 34, 32);
      c.strokeRect(-17, -16, 34, 32);
      c.beginPath();
      c.moveTo(-16, -15);
      c.lineTo(16, 15);
      c.moveTo(16, -15);
      c.lineTo(-16, 15);
      c.stroke();
      this.text('?', 0, 7, '#fff2c4', 23);
      if (box.y < 350) {
        c.strokeStyle = '#fff3c5';
        c.beginPath();
        c.moveTo(-16, -16);
        c.lineTo(-32, -55);
        c.lineTo(32, -55);
        c.lineTo(16, -16);
        c.stroke();
        c.fillStyle = '#f57649';
        c.beginPath();
        c.ellipse(0, -55, 35, 15, 0, Math.PI, 0);
        c.fill();
      }
      c.restore();
    }
    for (const q of s.players) {
      if (!q.alive) continue;
      if (q.glued > 0) {
        c.fillStyle = '#8eec7888';
        c.beginPath(); c.ellipse(q.x, q.y + 15, 25, 12, 0, 0, Math.PI * 2); c.fill();
        this.text('GLUE ' + q.glued.toFixed(1) + ' s', q.x, q.y - 72, '#a8ff87', 14);
      }
      if (q.rope) {
        c.strokeStyle = '#edd7a0';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(q.x, q.y);
        c.lineTo(q.rope.x, q.rope.y);
        c.stroke();
      }
      if (q.magnet > 0) {
        c.strokeStyle = '#7ce9ff';
        c.lineWidth = 3;
        c.setLineDash([9, 7]);
        c.beginPath();
        c.arc(q.x, q.y, 180, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
      }
      if (q.teleport) {
        c.strokeStyle = '#b89aff';
        c.lineWidth = 4;
        c.beginPath();
        c.ellipse(q.teleport.x, q.teleport.y, 20, 30, 0, 0, Math.PI * 2);
        c.stroke();
      }
      this.pirate(q, s.time, q.id === id, menu);
    }
    if (p && !menu && p.alive) {
      const weapon = WEAPONS[p.weapon];
      if (
        POWER_WEAPONS.includes(p.weapon) &&
        !p.pilot &&
        !p.rope &&
        p.jet <= 0
      ) {
        const power = charge > 0 ? Math.max(0.15, charge) : 0.15;
        const speed = p.weapon === 8 ? 160 + power * 270 : 240 + power * 490;
        let x = p.x + Math.cos(p.angle) * 20,
          y = p.y + Math.sin(p.angle) * 20,
          vx = Math.cos(p.angle) * speed,
          vy = Math.sin(p.angle) * speed;
        let contact = false;
        let travel = 0;
        const solid = (x: number, y: number) =>
          x < 0 ||
          x >= W ||
          y >= s.water ||
          (y >= 0 &&
            !!mask[Math.floor(y / CELL) * COLS + Math.floor(x / CELL)]) ||
          s.foams.some((f) => Math.hypot(x - f.x, y - f.y) < f.r);
        const limit =
          p.weapon === 17
            ? 0.75
            : p.weapon === 1
            ? p.input.fuse
            : p.weapon === 6
              ? 2
              : p.weapon === 8
                ? 2.8
                : 3;
        c.save();
        c.globalAlpha = p.cd > 0 ? 0.35 : 0.85;
        for (let n = 0; n < limit * 60; n++) {
          vy += 480 / 60;
          const steps = Math.ceil(Math.hypot(vx, vy) / 60 / 3) || 1;
          for (let k = 0; k < steps; k++) {
            x += vx / 60 / steps;
            y += vy / 60 / steps;
            travel += Math.hypot(vx, vy) / 60 / steps;
            if (solid(x, y)) {
              contact = true;
              break;
            }
          }
          if (n % 5 === 0) {
            c.fillStyle = '#fff6b2';
            c.strokeStyle = '#253b40';
            c.lineWidth = 1.5;
            c.beginPath();
            c.arc(x, y, 3.5, 0, 7);
            c.fill();
            c.stroke();
          }
          if (contact) break;
        }
        c.strokeStyle = '#ffde71';
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(x, y, 11, 0, 7);
        c.moveTo(x - 17, y);
        c.lineTo(x + 17, y);
        c.moveTo(x, y - 17);
        c.lineTo(x, y + 17);
        c.stroke();
        if (charge > 0)
          this.text(
            Math.round(power * 100) + ' %',
            p.x,
            p.y - 76,
            '#ffe985',
            20,
          );
        c.restore();
      }
      if (pilot) {
        c.strokeStyle = '#fff49b';
        c.lineWidth = 2;
        c.setLineDash([5, 6]);
        c.beginPath();
        c.moveTo(pilot.x, pilot.y);
        c.lineTo(p.input.tx, p.input.ty);
        c.stroke();
        c.setLineDash([]);
        this.text('CIBLE', p.input.tx, p.input.ty - 16, '#fff19e', 15);
      }

      if ([9, 14, 11].includes(p.weapon)) {
        const x=p.input.tx,y=p.input.ty;
        const advice=placementAdvice(p,p.weapon,x,y,s.players,s.water,(x,y)=>x<0||x>=W||y>=H||y>=0&&!!mask[Math.floor(y/CELL)*COLS+Math.floor(x/CELL)]||s.foams.some(f=>Math.hypot(x-f.x,y-f.y)<f.r));
        c.strokeStyle=advice.ok?'#97ffbd':'#ff8973';c.fillStyle=advice.ok?'#83eeb93b':'#f16f5630';c.lineWidth=3;c.setLineDash([6,4]);c.beginPath();c.arc(x,y,p.weapon===9?47:22,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([]);
        this.text(p.cd>0?'RECHARGE':advice.ok?'✓ EMPLACEMENT VALIDE':'✕ PLACEMENT IMPOSSIBLE',x,y-62,advice.ok?'#a3ffb9':'#ffad96',14);
      }
      const ax = p.input.tx,
        ay = p.input.ty;
      c.strokeStyle = '#fff5c7';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(ax, ay, 8, 0, Math.PI * 2);
      c.moveTo(ax - 13, ay);
      c.lineTo(ax + 13, ay);
      c.moveTo(ax, ay - 13);
      c.lineTo(ax, ay + 13);
      c.stroke();
      if (charge > 0) {
        c.strokeStyle = '#ffcd59';
        c.lineWidth = 5;
        c.beginPath();
        c.arc(p.x, p.y, 35, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
        c.stroke();
      }
      if (!p.alive) this.text('SPECTATEUR', p.x, p.y - 60, 'white', 24);
    }
    for (const shot of s.shots) {
      c.save();
      c.translate(shot.x, shot.y);
      if (shot.weapon === 16 || shot.weapon === 17 || shot.originWeapon === 17) {
        this.text(shot.weapon === 16 ? '🧴' : shot.weapon === 17 ? '🎆' : '✦', 0, 8,
          shot.weapon === 16 ? '#96ef75' : '#ff87df', shot.originWeapon === 17 && shot.weapon !== 17 ? 20 : 26);
      } else if (shot.weapon === 11) {
        c.strokeStyle = '#f9e8bd';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-18, -20);
        c.lineTo(-45, -65);
        c.lineTo(45, -65);
        c.lineTo(18, -20);
        c.stroke();
        c.fillStyle = '#ef7752';
        c.beginPath();
        c.ellipse(0, -65, 47, 20, 0, Math.PI, 0);
        c.fill();
        c.fillStyle = '#cef0e9';
        c.strokeStyle = '#173c42';
        c.lineWidth = 4;
        c.fillRect(-21, -29, 42, 58);
        c.strokeRect(-21, -29, 42, 58);
        c.beginPath();
        c.moveTo(-20, -9);
        c.lineTo(20, -9);
        c.moveTo(12, 0);
        c.lineTo(12, 14);
        c.stroke();
      } else if ([1, 6, 7, 8].includes(shot.weapon)) {
        c.rotate(shot.age * 3);
        c.fillStyle =
          shot.weapon === 8
            ? '#ec6043'
            : shot.weapon === 6
              ? '#ffe4a4'
              : '#29393b';
        c.strokeStyle = '#131f27';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, shot.weapon === 7 ? 10 : 9, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = '#ffc33e';
        c.fillRect(-2, -15, 4, 7);
      } else if (shot.weapon === 5) {
        c.rotate(Math.atan2(shot.vy, shot.vx));
        c.fillStyle = '#ecede0';
        c.strokeStyle = '#173c42';
        c.lineWidth = 3;
        c.beginPath();
        c.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(-5, 0);
        c.lineTo(-14, -23 * Math.sin(shot.age * 24));
        c.lineTo(9, 0);
        c.fill();
        c.fillStyle = '#ffb341';
        c.fillRect(17, -3, 8, 5);
        c.fillStyle = '#172d37';
        c.beginPath();
        c.arc(10, -3, 2, 0, 7);
        c.fill();
      } else {
        c.rotate(Math.atan2(shot.vy, shot.vx));
        c.fillStyle = shot.weapon === 2 ? '#e7b984' : '#e3d8a8';
        c.strokeStyle = '#273b38';
        c.lineWidth = 3;
        c.beginPath();
        c.roundRect(-13, -6, 26, 12, 4);
        c.fill();
        c.stroke();
        if (shot.weapon !== 2) {
          c.fillStyle = '#ff9d33';
          c.beginPath();
          c.moveTo(-14, -5);
          c.lineTo(-28 - Math.random() * 14, 0);
          c.lineTo(-14, 5);
          c.fill();
        }
      }
      c.restore();
      if ([1, 6, 8].includes(shot.weapon))
        this.text(
          Math.max(0, shot.life).toFixed(1),
          shot.x,
          shot.y - 22,
          '#fff4bf',
          14,
        );
    }
    for (const e of s.effects) {
      if (this.seen.has(e.id)) continue;
      this.seen.add(e.id);
      if (e.type === 'lightning') {
        for (let n = 0; n < 18; n++) this.particles.push({
          x: e.x + (n % 2 ? 10 : -10), y: e.y - n * 22, vx: 0, vy: 0,
          life: 0.45, max: 0.45, r: 8, color: '#b8f4ff',
        });
        this.onSound?.('fire');
      }
      if (['explosion', 'death'].includes(e.type)) {
        this.shake = Math.min(15, e.r * 0.17) * this.shakeAmount;
        this.onSound?.(e.type);
        for (let n = 0; n < Math.min(28, e.r / 2); n++)
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 400,
            vy: -Math.random() * 300,
            life: 0.4 + Math.random() * 0.6,
            max: 1,
            r: 4 + Math.random() * 12,
            color: ['#ffcc54', '#ff783b', '#fff1b9', '#a77544'][n % 4],
          });
        this.particles.push({
          x: e.x,
          y: e.y,
          vx: 0,
          vy: 0,
          life: 0.25,
          max: 0.25,
          r: e.r,
          color: '#ffe597',
        });
      } else if (e.type === 'fire') this.onSound?.('fire');
      if (e.text)
        this.particles.push({
          x: e.x,
          y: e.y,
          vx: 0,
          vy: -40,
          life: 1.3,
          max: 1.3,
          r: 0,
          color: e.color || '#fff1b3',
          text: e.text,
        });
      if (['jet', 'jump'].includes(e.type))
        for (let n = 0; n < 3; n++)
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 50,
            vy: 60,
            life: 0.3,
            max: 0.3,
            r: 7,
            color: e.type === 'jet' ? '#ffb239' : '#e1be89',
          });
    }
    this.particles = this.particles.slice(-250);
    for (const f of this.particles) {
      f.life -= dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (!f.text) f.vy += 180 * dt;
      c.globalAlpha = Math.max(0, f.life / f.max);
      if (f.text) this.text(f.text, f.x, f.y, f.color, 24);
      else {
        c.fillStyle = f.color;
        c.beginPath();
        c.arc(f.x, f.y, f.r * Math.max(0.1, f.life / f.max), 0, 7);
        c.fill();
      }
    }
    c.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
    c.fillStyle = '#096b80dc';
    c.beginPath();
    c.moveTo(0, H + 100);
    for (let x = 0; x <= W; x += 15)
      c.lineTo(x, s.water + Math.sin(x / 30 + s.time * 3) * 5);
    c.lineTo(W, H + 100);
    c.closePath();
    c.fill();
    c.strokeStyle = '#8be0d2';
    c.lineWidth = 4;
    c.beginPath();
    for (let x = 0; x <= W; x += 15)
      c.lineTo(x, s.water + Math.sin(x / 30 + s.time * 3) * 5);
    c.stroke();
    c.restore();
    if (!menu)
      for (const q of s.players.filter((q) => q.alive && q.id !== id)) {
        const sx = (q.x - this.cam.x) * this.cam.zoom + width / 2,
          sy = (q.y - this.cam.y) * this.cam.zoom + height / 2;
        if (sx < 20 || sx > width - 20 || sy < 90 || sy > height - 150) {
          const x = Math.max(20, Math.min(width - 20, sx)),
            y = Math.max(105, Math.min(height - 160, sy));
          c.fillStyle = q.color;
          c.beginPath();
          c.arc(x, y, 11, 0, 7);
          c.fill();
          c.fillStyle = '#112e37';
          c.font = 'bold 13px Arial';
          c.textAlign = 'center';
          c.fillText(sx < 20 ? '‹' : sx > width - 20 ? '›' : '!', x, y + 4);
        }
      }
  }
  text(text: string, x: number, y: number, color: string, size: number) {
    const c = this.ctx;
    c.font = `900 ${size}px Trebuchet MS`;
    c.textAlign = 'center';
    c.lineJoin = 'round';
    c.strokeStyle = '#17323c';
    c.lineWidth = 4;
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  pirate(p: Player, time: number, local = false, menu = false) {
    const c = this.ctx;
    c.save();
    c.translate(p.x, p.y);
    const facing = Math.cos(p.angle) >= 0 ? 1 : -1;
    const squash = p.ground
      ? 1 + Math.sin(time * 9) * 0.025
      : Math.min(1.22, 1 + Math.abs(p.vy) / 1800);
    c.scale(1 / squash, squash);
    c.lineWidth = 3.5;
    c.strokeStyle = '#203638';
    c.fillStyle = p.color;
    c.beginPath();
    c.moveTo(-14, 12);
    c.bezierCurveTo(-24, -8, -15, -28, 0, -27);
    c.bezierCurveTo(22, -26, 22, -5, 14, 10);
    c.bezierCurveTo(27, 17, 6, 23, -14, 18);
    c.quadraticCurveTo(-27, 16, -14, 12);
    c.fill();
    c.stroke();
    c.fillStyle = '#fff4d4';
    c.beginPath();
    c.ellipse(4 * facing, -12, 10, 11, 0, 0, 7);
    c.fill();
    c.stroke();
    c.fillStyle = '#1e3139';
    c.beginPath();
    c.arc(7 * facing, -12, 4, 0, 7);
    c.fill();
    c.fillStyle = '#eae1c0';
    c.beginPath();
    c.ellipse(-9 * facing, -12, 6, 9, 0, 0, 7);
    c.fill();
    c.fillStyle = '#203638';
    c.beginPath();
    c.ellipse(-9 * facing, -12, 6, 8, 0, 0, 7);
    c.fill();
    c.beginPath();
    c.moveTo(-17, -21);
    c.lineTo(15, -8);
    c.stroke();
    c.fillStyle = '#be4437';
    c.beginPath();
    c.moveTo(-20, -24);
    c.quadraticCurveTo(-5, -43, 12, -27);
    c.lineTo(22, -25);
    c.lineTo(19, -18);
    c.quadraticCurveTo(0, -24, -19, -17);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#fff3ca';
    c.beginPath();
    c.arc(0, -29, 4, 0, 7);
    c.fill();
    c.fillStyle = '#fff3cd';
    c.beginPath();
    c.roundRect(-3, 2, 15, 6, 3);
    c.fill();
    c.stroke();
    c.fillStyle = '#e8b347';
    c.beginPath();
    c.arc(-19, 0, 5, 0, 7);
    c.stroke();
    c.save();
    c.rotate(p.angle);
    c.fillStyle = p.weapon === 3 ? '#e86642' : '#597173';
    c.beginPath();
    c.roundRect(5, -1, 30, 10, 3);
    c.fill();
    c.stroke();
    c.fillStyle = '#d7bc85';
    c.fillRect(25, -2, 5, 12);
    c.restore();
    c.restore();
    if (!menu) {
      this.text((local ? '▼ ' : '') + p.name, p.x, p.y - 51, p.color, 15);
      c.fillStyle = '#112b35';
      c.fillRect(p.x - 23, p.y - 43, 46, 5);
      c.fillStyle = p.color;
      c.fillRect(p.x - 23, p.y - 43, (46 * p.hp) / 100, 5);
      if (p.cd > 0) {
        c.fillStyle = '#12313a';
        c.fillRect(p.x - 20, p.y + 29, 40, 4);
        c.fillStyle = '#ffd066';
        c.fillRect(p.x - 20, p.y + 29, 40 * (1 - p.cd / 8), 4);
      }
    }
  }
}
