export const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

export const tween = (ms: number, step: (k: number) => void) =>
  new Promise<void>((resolve) => {
    const start = performance.now();
    const frame = (time: number) => {
      const k = Math.min(1, (time - start) / ms);
      step(ease(k));
      if (k < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];
export const shuffle = <T>(items: T[]) =>
  items
    .map((item) => [Math.random(), item] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);
