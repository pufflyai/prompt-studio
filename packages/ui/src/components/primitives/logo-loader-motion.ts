// Motion for LogoLoader: a rigid-body simulation of the ring inside the logo's rotating square.
//
// The square is a drum turning about its centre. The ring is a disc under gravity. Collisions use
// the moving wall's velocity, restitution along the normal and Coulomb friction along the wall, so
// the drum carries the ring up and drops it. One drum cycle is simulated once at a fixed step and
// replayed; it starts from a resting spot the cycle returns to, so the loop closes.
// The design study in design/motion/studies/logo-loader explores variants and outcome animations.

type Point = { x: number; y: number };

export interface LogoFrame {
  angle: number;
  ring: Point;
  ringScale: Point;
}

const CENTER = 13;
const OUTER = 5;
const INNER = 3;
const LOOP = 3.2;
const HZ = 960;
const DT = 1 / HZ;
// Frames kept per second of the loop; the simulation itself runs at HZ.
const FRAME_RATE = 240;
const GRAVITY = 260;
// The ring's centre stays inside a rounded box: half-size 6 leaves a 2-unit drum wall.
const HALF = 6;
const CORNER = 1;
const FRICTION = 0.35;
const RESTITUTION = 0.6;
// The resting spot one drum cycle returns the ring to, found by the design study's fixed-point search.
const START_X = 17.5;
const SQUARE = "M8 0H18A8 8 0 0 1 26 8V18A8 8 0 0 1 18 26H8A8 8 0 0 1 0 18V8A8 8 0 0 1 8 0Z";

export const logoAtRest: LogoFrame = { angle: 0, ring: { x: 10, y: 11 }, ringScale: { x: 1, y: 1 } };

interface Body {
  p: Point;
  v: Point;
  hit: { at: number; n: Point; strength: number };
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeInOutBack = (x: number) => {
  const c = 0.8 * 1.525;
  const p = clamp(x);
  return p < 0.5
    ? ((2 * p) ** 2 * ((c + 1) * 2 * p - c)) / 2
    : ((2 * p - 2) ** 2 * ((c + 1) * (2 * p - 2) + c) + 2) / 2;
};

// Turn a full revolution, rest so the ring settles, turn back, rest.
const drumTheta = (time: number) => {
  const turn = 2 * Math.PI;
  if (time < 1) return turn * easeInOutBack(time);
  if (time < 1.6) return turn;
  if (time < 2.6) return turn - turn * easeInOutBack(time - 1.6);
  return 0;
};

const toDrum = (p: Point, theta: number) => {
  const dx = p.x - CENTER;
  const dy = p.y - CENTER;
  return { x: dx * Math.cos(theta) + dy * Math.sin(theta), y: -dx * Math.sin(theta) + dy * Math.cos(theta) };
};

const collide = (body: Body, theta: number, omega: number, time: number) => {
  const q = toDrum(body.p, theta);
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
  // Touching counts as contact, so resting friction acts before the ring moves.
  if (depth <= -0.02) return;
  const n = {
    x: local.x * Math.cos(theta) - local.y * Math.sin(theta),
    y: local.x * Math.sin(theta) + local.y * Math.cos(theta),
  };
  if (depth > 0) body.p = { x: body.p.x - n.x * depth, y: body.p.y - n.y * depth };
  // The wall moves with the drum: its velocity at the contact point is ω × r.
  const contact = { x: body.p.x + n.x * OUTER, y: body.p.y + n.y * OUTER };
  const rel = { x: body.v.x + omega * (contact.y - CENTER), y: body.v.y - omega * (contact.x - CENTER) };
  const vn = rel.x * n.x + rel.y * n.y;
  if (vn <= 0) return;
  // Slow contacts are resting contacts: no bounce, so the ring can settle.
  const normalImpulse = (1 + (vn > 14 ? RESTITUTION : 0)) * vn;
  const tangent = { x: rel.x - vn * n.x, y: rel.y - vn * n.y };
  const slide = Math.hypot(tangent.x, tangent.y);
  const friction = slide > 0 ? Math.min(slide, FRICTION * normalImpulse) / slide : 0;
  body.v = {
    x: body.v.x - normalImpulse * n.x - friction * tangent.x,
    y: body.v.y - normalImpulse * n.y - friction * tangent.y,
  };
  if (vn > 25) body.hit = { at: time, n: local, strength: Math.min(1, vn / 140) };
};

const frameOf = (body: Body, theta: number, time: number, offset: Point) => {
  const q = toDrum(body.p, theta);
  // The ring squashes against the wall it hit and recovers quickly.
  const amount = body.hit.at < 0 ? 0 : 0.24 * body.hit.strength * Math.exp(-(time - body.hit.at) / 0.05);
  const sx = 1 - amount * Math.abs(body.hit.n.x);
  const sy = 1 - amount * Math.abs(body.hit.n.y);
  const push = OUTER * amount;
  return {
    angle: (theta * 180) / Math.PI,
    ring: {
      x: CENTER + q.x - offset.x + body.hit.n.x * push,
      y: CENTER + q.y - offset.y + body.hit.n.y * push,
    },
    ringScale: { x: sx / Math.sqrt(sy), y: sy / Math.sqrt(sx) },
  };
};

const simulateLoop = () => {
  const start = { x: START_X, y: CENTER + HALF };
  const body: Body = { p: { ...start }, v: { x: 0, y: 0 }, hit: { at: -1, n: { x: 0, y: 1 }, strength: 0 } };
  const states: { body: Body; theta: number; time: number }[] = [];
  const steps = Math.round(LOOP * HZ);
  for (let i = 0; i <= steps; i++) {
    const time = i * DT;
    const theta = drumTheta(time);
    if (i % (HZ / FRAME_RATE) === 0) states.push({ body: { ...body }, theta, time });
    const next = drumTheta(time + DT);
    const omega = (next - theta) / DT;
    body.v = { x: body.v.x, y: body.v.y + GRAVITY * DT };
    collide(body, theta, omega, time);
    body.p = { x: body.p.x + body.v.x * DT, y: body.p.y + body.v.y * DT };
    for (let pass = 0; pass < 2; pass++) collide(body, next, omega, time + DT);
  }
  // Ease out the tiny remainder while the ring rests at the end of the cycle.
  const end = states[states.length - 1].body.p;
  const residual = { x: end.x - start.x, y: end.y - start.y };
  return states.map(({ body: state, theta, time }) => {
    const ease = clamp((time - (LOOP - 0.4)) / 0.4);
    return frameOf(state, theta, time, { x: residual.x * ease, y: residual.y * ease });
  });
};

let frames: LogoFrame[] | undefined;

/** The loader frame `seconds` after it started; the motion loops every 3.2 seconds. */
export const logoLoaderFrameAt = (seconds: number) => {
  frames ??= simulateLoop();
  const t = seconds - Math.floor(seconds / LOOP) * LOOP;
  return frames[Math.min(frames.length - 1, Math.round(t * FRAME_RATE))];
};

const ellipse = (c: Point, rx: number, ry: number) =>
  `M${c.x - rx} ${c.y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`;

/** The mark's path in the square's own frame: the rounded square with the ring cut out. */
export const logoPath = (frame: LogoFrame) => {
  const { ring, ringScale } = frame;
  return (
    SQUARE +
    ellipse(ring, OUTER * ringScale.x, OUTER * ringScale.y) +
    ellipse(ring, INNER * ringScale.x, INNER * ringScale.y)
  );
};
