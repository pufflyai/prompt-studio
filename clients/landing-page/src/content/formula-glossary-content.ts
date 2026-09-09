export const EXAMPLE_FORMULAS = [
  {
    id: "sine",
    name: "Sine wave",
    equation: "y = sin(2πx)",
    description: "Make something pulse, loop, or oscillate.",
    expression: "Math.sin(2 * Math.PI * x)",
    evaluate: (x: number) => Math.sin(2 * Math.PI * x),
  },
  {
    id: "smoothstep",
    name: "Smooth step",
    equation: "y = 3x² − 2x³",
    description: "Ease into a transition and slow down at the end.",
    expression: "x * x * (3 - 2 * x)",
    evaluate: (x: number) => x * x * (3 - 2 * x),
  },
  {
    id: "quadratic",
    name: "Ease in",
    equation: "y = x²",
    description: "Start a movement slowly, then pick up speed.",
    expression: "x * x",
    evaluate: (x: number) => x * x,
  },
];

export type ExampleFormula = (typeof EXAMPLE_FORMULAS)[number];
