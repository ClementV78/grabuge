import { World, DT, type Input, type Snapshot, type Player } from './engine';
/** Replays unacknowledged movement; combat remains entirely authoritative. */
export class NetView {
  prediction = new World(1, true);
  pending: Input[] = [];
  id = '';
  lastSeed = -1;
  positions = new Map<string, { x: number; y: number }>();
  accept(s: Snapshot, mask: Uint8Array, id: string) {
    if (s.seed !== this.lastSeed) {
      this.pending = [];
      this.positions.clear();
      this.lastSeed = s.seed;
    }
    this.id = id;
    this.prediction.terrain = mask;
    this.prediction.foams = s.foams;
    this.prediction.shots=structuredClone(s.shots);
    this.prediction.water = s.water;
    this.prediction.players = structuredClone(s.players);
    this.prediction.time = s.time;
    const p = this.prediction.players.find((p) => p.id === id);
    if (!p) return;
    this.pending = this.pending.filter((i) => i.seq > p.input.seq);
    for (const i of this.pending) this.move(p, i);
  }
  move(p: Player, i: Input) {
    p.input = { ...i, fire: false, action: false };
    this.prediction.move(p, DT);
    this.prediction.effects = [];
  }
  sent(i: Input) {
    this.pending.push({ ...i });
    if (this.pending.length > 90) this.pending.shift();
    const p = this.prediction.players.find((p) => p.id === this.id && p.alive);
    if (p) this.move(p, i);
  }
  render(s: Snapshot, dt: number) {
    const view = structuredClone(s);
    for (const p of view.players) {
      const predicted = this.prediction.players.find((q) => q.id === p.id);
      const target = p.id === this.id && predicted ? predicted : p;
      const old = this.positions.get(p.id) || { x: target.x, y: target.y };
      const d = Math.hypot(target.x - old.x, target.y - old.y);
      const f = d > 140 ? 1 : Math.min(1, dt * (p.id === this.id ? 35 : 15));
      old.x += (target.x - old.x) * f;
      old.y += (target.y - old.y) * f;
      this.positions.set(p.id, old);
      p.x = old.x;
      p.y = old.y;
    }
    return view;
  }
}
