// Commits take turns within each sample, and the order reverses every sample (A B, B A, ...).
// Drift on the runner, such as heat or a noisy neighbour, then lands on every commit equally.
export const sampleOrder = <T>(commits: T[], samples: number) =>
  Array.from({ length: samples }, (_, sample) => {
    const order = sample % 2 === 0 ? commits : [...commits].reverse();
    return order.map((commit) => ({ commit, sample }));
  }).flat();
