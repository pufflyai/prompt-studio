interface Point {
  x: number;
  y: number;
}

const THROW_WINDOW = 50;

/** Use collision-resolved travel so a quiet input tick cannot erase a throw. */
export const trackDragMomentum = (initial: Point) => {
  let previous = { ...initial };
  const samples: { x: number; y: number; duration: number }[] = [];
  return {
    sample: (point: Point, duration: number) => {
      samples.push({ x: point.x - previous.x, y: point.y - previous.y, duration });
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
    velocity: () => {
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
    },
    reset: (point: Point) => {
      previous = { ...point };
      samples.length = 0;
    },
  };
};
