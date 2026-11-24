// Rigid-body simulation of the logo ring inside the rotating drum.
//
// The drum is the logo's rounded square, turning about its centre. The ring is a disc under world
// gravity. Each collision uses the moving wall's velocity at the contact point, with restitution
// along the normal and Coulomb friction along the wall, so the drum carries the ring up and drops it.
// Everything is simulated at a fixed step and sampled, so scrubbing is exact and repeatable.

export type Point = { x: number; y: number };
export type Outcome = "loop" | "success" | "failure";

export const CENTER = 13;
export const HOME = { x: 10, y: 11 };
export const OUTER = 5;
export const INNER = 3;
export const LOOP = 3.2;
export const RESULT_AT = 7;
export const EXIT_SECONDS = 3;

const HZ = 960;
const DT = 1 / HZ;
const GRAVITY = 260;
// The ring's centre stays inside a rounded box: half-size 6 leaves a 2-unit drum wall.
const HALF = 6;
const CORNER = 1;
const FRICTION = 0.35;

export interface Frame {
  angle: number; // degrees
  ring: Point; // drum frame
  ringScale: Point;
  shift: Point;
  scale: number;
  opacity: number;
}

interface Pose {
  theta: number;
  center: Point;
}
interface Body {
  p: Point;
  v: Point;
  hit: { at: number; n: Point; strength: number };
}
interface Sample {
  pose: Pose;
  p: Point;
  v: Point;
  hit: Body["hit"];
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, p: number) => from + (to - from) * p;
const easeInCubic = (x: number) => clamp(x) ** 3;
const easeOutBack = (x: number, overshoot = 1.2) => {
  const p = clamp(x) - 1;
  return 1 + (overshoot + 1) * p ** 3 + overshoot * p ** 2;
};
const easeInOutBack = (x: number, overshoot = 0.8) => {
  const c = overshoot * 1.525;
  const p = clamp(x);
  return p < 0.5
    ? ((2 * p) ** 2 * ((c + 1) * 2 * p - c)) / 2
    : ((2 * p - 2) ** 2 * ((c + 1) * (2 * p - 2) + c) + 2) / 2;
};

// Drum motion for one loop: turn, rest so the ring settles, turn back (or keep going), rest.
const loopTheta = (time: number, drum: string) => {
  const p = time - Math.floor(time / LOOP) * LOOP;
  const turn = 2 * Math.PI;
  if (drum === "oneway") return turn * easeInOutBack(p / 2.4);
  if (p < 1) return turn * easeInOutBack(p);
  if (p < 1.6) return turn;
  if (p < 2.6) return turn - turn * easeInOutBack(p - 1.6);
  return 0;
};

const toDrum = (p: Point, pose: Pose): Point => {
  const dx = p.x - pose.center.x;
  const dy = p.y - pose.center.y;
  const c = Math.cos(pose.theta);
  const s = Math.sin(pose.theta);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
};

// Velocity of a point fixed to the drum: centre velocity plus ω × r.
const wallVelocity = (point: Point, pose: Pose, omega: number, centerVelocity: Point): Point => ({
  x: centerVelocity.x - omega * (point.y - pose.center.y),
  y: centerVelocity.y + omega * (point.x - pose.center.x),
});

const collide = (body: Body, pose: Pose, omega: number, centerVelocity: Point, restitution: number, time: number) => {
  const q = toDrum(body.p, pose);
  const ax = Math.abs(q.x) - (HALF - CORNER);
  const ay = Math.abs(q.y) - (HALF - CORNER);
  let depth: number;
  let local: Point;
  if (ax > 0 && ay > 0) {
    const length = Math.hypot(ax, ay);
    depth = length - CORNER;
    local = { x: (Math.sign(q.x) * ax) / length, y: (Math.sign(q.y) * ay) / length };
  } else if (ax > ay) {
    depth = ax - CORNER;
    local = { x: Math.sign(q.x), y: 0 };
  } else {
    depth = ay - CORNER;
    local = { x: 0, y: Math.sign(q.y) };
  }
  // Touching counts as contact (within a small slop), so resting friction acts before the ring moves.
  if (depth <= -0.02) return;
  const c = Math.cos(pose.theta);
  const s = Math.sin(pose.theta);
  const n = { x: local.x * c - local.y * s, y: local.x * s + local.y * c };
  if (depth > 0) body.p = { x: body.p.x - n.x * depth, y: body.p.y - n.y * depth };
  const contact = { x: body.p.x + n.x * OUTER, y: body.p.y + n.y * OUTER };
  const wall = wallVelocity(contact, pose, omega, centerVelocity);
  const rel = { x: body.v.x - wall.x, y: body.v.y - wall.y };
  const vn = rel.x * n.x + rel.y * n.y;
  if (vn <= 0) return;
  // Slow contacts are resting contacts: no bounce, so the ring can settle.
  const normalImpulse = (1 + (vn > 14 ? restitution : 0)) * vn;
  const tangent = { x: rel.x - vn * n.x, y: rel.y - vn * n.y };
  const slide = Math.hypot(tangent.x, tangent.y);
  const friction = slide > 0 ? Math.min(slide, FRICTION * normalImpulse) / slide : 0;
  body.v = {
    x: body.v.x - normalImpulse * n.x - friction * tangent.x,
    y: body.v.y - normalImpulse * n.y - friction * tangent.y,
  };
  if (vn > 25) body.hit = { at: time, n: local, strength: Math.min(1, vn / 140) };
};

type Force = (body: Body, pose: Pose, omega: number, time: number) => Point;
const gravity: Force = () => ({ x: 0, y: GRAVITY });

const simulate = (
  start: Body,
  from: number,
  seconds: number,
  poseAt: (time: number) => Pose,
  restitution: number,
  force: Force = gravity,
) => {
  const body: Body = { p: { ...start.p }, v: { ...start.v }, hit: start.hit };
  const samples: Sample[] = [];
  const steps = Math.round(seconds * HZ);
  for (let i = 0; i <= steps; i++) {
    const time = from + i * DT;
    const pose = poseAt(time);
    samples.push({ pose, p: { ...body.p }, v: { ...body.v }, hit: body.hit });
    const next = poseAt(time + DT);
    const omega = (next.theta - pose.theta) / DT;
    const centerVelocity = { x: (next.center.x - pose.center.x) / DT, y: (next.center.y - pose.center.y) / DT };
    const a = force(body, pose, omega, time);
    body.v = { x: body.v.x + a.x * DT, y: body.v.y + a.y * DT };
    // Resolve contact velocity first (static friction cancels gravity's slide), then move.
    collide(body, pose, omega, centerVelocity, restitution, time);
    body.p = { x: body.p.x + body.v.x * DT, y: body.p.y + body.v.y * DT };
    for (let pass = 0; pass < 2; pass++) collide(body, next, omega, centerVelocity, restitution, time + DT);
  }
  return samples;
};

const restingAt = (x: number): Body => ({
  p: { x, y: CENTER + HALF },
  v: { x: 0, y: 0 },
  hit: { at: -1, n: { x: 0, y: 1 }, strength: 0 },
});

// The loop starts with the ring resting on the drum floor. Pick the resting spot the ring returns
// to after one full drum cycle, so the loop closes; any tiny remainder is eased out while it rests.
const solveLoop = (drum: string, restitution: number) => {
  const poseAt = (time: number): Pose => ({ theta: loopTheta(time, drum), center: { x: CENTER, y: CENTER } });
  const run = (x: number) => simulate(restingAt(x), 0, LOOP, poseAt, restitution);
  const miss = (x: number) => {
    const end = run(x).at(-1) as Sample;
    const dx = end.p.x - x;
    return { x, dx, error: Math.hypot(dx, end.p.y - (CENTER + HALF)) };
  };
  const floor = HALF - CORNER;
  const scan = Array.from({ length: 61 }, (_, i) => miss(CENTER - floor + (2 * floor * i) / 60));
  let best = scan.reduce((a, b) => (b.error < a.error ? b : a));
  const crossings = scan
    .slice(1)
    .map((high, i) => ({ low: scan[i], high }))
    .filter(({ low, high }) => Math.sign(low.dx) !== Math.sign(high.dx))
    .sort((a, b) => a.low.error + a.high.error - (b.low.error + b.high.error))
    .slice(0, 3);
  for (let { low, high } of crossings) {
    for (let k = 0; k < 20; k++) {
      const mid = miss((low.x + high.x) / 2);
      if (mid.error < best.error) best = mid;
      if (Math.sign(mid.dx) === Math.sign(low.dx)) low = mid;
      else high = mid;
    }
  }
  const samples = run(best.x);
  const end = samples.at(-1) as Sample;
  return { samples, residual: { x: end.p.x - best.x, y: end.p.y - (CENTER + HALF) } };
};

const loops = new Map<string, ReturnType<typeof solveLoop>>();
const loopFor = (drum: string, restitution: number) => {
  const key = `${drum}|${restitution}`;
  let loop = loops.get(key);
  if (!loop) {
    loop = solveLoop(drum, restitution);
    loops.set(key, loop);
  }
  return loop;
};

const squashed = (hit: Body["hit"], time: number) => {
  const amount = hit.at < 0 ? 0 : 0.24 * hit.strength * Math.exp(-(time - hit.at) / 0.05);
  const sx = 1 - amount * Math.abs(hit.n.x);
  const sy = 1 - amount * Math.abs(hit.n.y);
  return { amount, scale: { x: sx / Math.sqrt(sy), y: sy / Math.sqrt(sx) } };
};

const frameOf = (sample: Sample, time: number, offset: Point = { x: 0, y: 0 }): Frame => {
  const q = toDrum(sample.p, sample.pose);
  const squash = squashed(sample.hit, time);
  // A squashed ring stays against the wall it hit.
  const push = OUTER * squash.amount;
  return {
    angle: (sample.pose.theta * 180) / Math.PI,
    ring: {
      x: CENTER + q.x - offset.x + sample.hit.n.x * push,
      y: CENTER + q.y - offset.y + sample.hit.n.y * push,
    },
    ringScale: squash.scale,
    shift: { x: sample.pose.center.x - CENTER, y: sample.pose.center.y - CENTER },
    scale: 1,
    opacity: 1,
  };
};

const cache = new Map<string, (time: number) => Frame>();

const build = (outcome: Outcome, drum: string, restitution: number, resultAt: number) => {
  const loop = loopFor(drum, restitution);
  const loopFrame = (time: number) => {
    const t = time - Math.floor(time / LOOP) * LOOP;
    const sample = loop.samples[Math.min(loop.samples.length - 1, Math.round(t * HZ))];
    const ease = clamp((t - (LOOP - 0.4)) / 0.4);
    return frameOf(sample, t, { x: loop.residual.x * ease, y: loop.residual.y * ease });
  };
  if (outcome === "loop") return loopFrame;

  const handoffTime = resultAt - Math.floor(resultAt / LOOP) * LOOP;
  const handoff = loop.samples[Math.round(handoffTime * HZ)];
  const start: Body = { p: handoff.p, v: handoff.v, hit: { ...handoff.hit, at: handoff.hit.at - handoffTime } };
  const theta0 = handoff.pose.theta;
  const omega0 = (loopTheta(handoffTime + 0.001, drum) - loopTheta(handoffTime, drum)) / 0.001;

  if (outcome === "success") {
    // The drum flicks the ring up on a ballistic arc that peaks just above home; on the way down it
    // snaps into the logo position. The drum carries its spin into the flight and lands upright.
    const p0 = handoff.p;
    const apexY = Math.min(HOME.y - 2, p0.y - 1);
    const rise = Math.sqrt((2 * (p0.y - apexY)) / GRAVITY);
    const flight = rise + Math.sqrt((2 * (HOME.y - apexY)) / GRAVITY);
    const launch = { x: (HOME.x - p0.x) / flight, y: -GRAVITY * rise };
    const upright = Math.round(theta0 / (2 * Math.PI)) * 2 * Math.PI;
    const thetaAt = (s: number) => {
      const u = clamp(s / flight);
      return (
        (2 * u ** 3 - 3 * u ** 2 + 1) * theta0 +
        (u ** 3 - 2 * u ** 2 + u) * omega0 * flight +
        (3 * u ** 2 - 2 * u ** 3) * upright
      );
    };
    return (time: number) => {
      if (time < resultAt) return loopFrame(time);
      const s = time - resultAt;
      if (s < flight) {
        const pose = { theta: thetaAt(s), center: { x: CENTER, y: CENTER } };
        const p = { x: p0.x + launch.x * s, y: p0.y + launch.y * s + 0.5 * GRAVITY * s * s };
        return frameOf({ pose, p, v: { x: launch.x, y: launch.y + GRAVITY * s }, hit: start.hit }, s);
      }
      const after = s - flight;
      const clunk = Math.sin(after * 32) * Math.exp(-after * 11);
      return {
        angle: (upright * 180) / Math.PI,
        ring: HOME,
        ringScale: squashed({ at: 0, n: { x: 0, y: 1 }, strength: 0.7 }, after).scale,
        shift: { x: 0, y: 0 },
        scale: 1 - 0.06 * clunk,
        opacity: 1,
      };
    };
  }

  // Failure: the drum spins up off-balance and wobbles, then seizes crooked and sags.
  const seize = 0.7;
  const spinTheta = (s: number) => theta0 + omega0 * s + 0.5 * 30 * s * s;
  const seized = spinTheta(seize);
  const crooked = Math.round(seized / (Math.PI / 2)) * (Math.PI / 2) + (14 * Math.PI) / 180;
  const poseAt = (s: number): Pose => {
    const wobble = s < seize ? 1.3 * easeInCubic(s / seize) : 1.3 * (1 - clamp((s - seize) / 0.08));
    const theta = s < seize ? spinTheta(s) : lerp(seized, crooked, easeOutBack((s - seize) / 0.15, 2));
    const sag = s < seize ? 0 : 1.2 * easeOutBack((s - seize) / 0.2, 2);
    return {
      theta,
      center: { x: CENTER + wobble * Math.cos(theta), y: CENTER + wobble * Math.sin(theta) + sag },
    };
  };
  const samples = simulate(start, 0, EXIT_SECONDS, poseAt, restitution);
  return (time: number) => {
    if (time < resultAt) return loopFrame(time);
    const s = time - resultAt;
    return frameOf(samples[Math.min(samples.length - 1, Math.round(s * HZ))], s);
  };
};

// `resultAt` is when the outcome arrives, in seconds since loading started.
export const ringMotion = (outcome: Outcome, drum: string, bounce: string, resultAt = RESULT_AT) => {
  const key = `${outcome}|${drum}|${bounce}|${outcome === "loop" ? 0 : resultAt.toFixed(3)}`;
  let motion = cache.get(key);
  if (!motion) {
    motion = build(outcome, drum, bounce === "soft" ? 0.35 : 0.6, resultAt);
    cache.set(key, motion);
  }
  return motion;
};
