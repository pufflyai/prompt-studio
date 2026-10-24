interface Point {
  x: number;
  y: number;
}

const THROW_WINDOW = 50;
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

/** Use collision-resolved travel so a quiet input tick cannot erase a throw. */
export const trackDragMomentum = (initial: Point) => {
  let previous = { ...initial };
  const samples: { x: number; y: number; duration: number }[] = [];
  const velocity = () => {
    let duration = 0;
    const travel = { x: 0, y: 0 };
    for (let index = samples.length - 1; index >= 0 && duration < THROW_WINDOW; index--) {
      const sample = samples[index];
      const time = Math.min(sample.duration, THROW_WINDOW - duration);
      travel.x += (sample.x * time) / sample.duration;
      travel.y += (sample.y * time) / sample.duration;
      duration += time;
    }
    const scale = duration ? 1000 / 60 / duration : 0;
    return { x: travel.x * scale, y: travel.y * scale };
  };
  return {
    sample: (point: Point, duration: number, direction: Point) => {
      const movement = { x: point.x - previous.x, y: point.y - previous.y };
      const current = velocity();
      // Input can reverse just before release. Wait for the body to follow it.
      if (dot(direction, current) < 0 && dot(movement, current) < 0 && dot(movement, direction) > 0) samples.length = 0;
      samples.push({ ...movement, duration });
      previous = { ...point };
      let elapsed = 0;
      for (let index = samples.length - 1; index >= 0; index--) {
        elapsed += samples[index].duration;
        if (elapsed >= THROW_WINDOW) {
          samples.splice(0, index);
          break;
        }
      }
    },
    velocity,
    reset: (point: Point) => {
      previous = { ...point };
      samples.length = 0;
    },
  };
};
