export interface FormulaInputs {
  principal: number;
  rate: number;
  years: number;
}

export const EXAMPLE_FORMULAS = [
  {
    id: "compound",
    name: "Compound growth",
    equation: "A = P × (1 + r)ᵗ",
    description: "Interest earns interest. Watch the difference grow over time.",
    rateLabel: "Annual return",
    resultLabel: "Future value",
    evaluate: ({ principal, rate, years }: FormulaInputs) => principal * (1 + rate / 100) ** years,
  },
  {
    id: "simple",
    name: "Simple interest",
    equation: "A = P × (1 + r × t)",
    description: "Earn interest on the starting amount, without compounding.",
    rateLabel: "Annual interest",
    resultLabel: "Future value",
    evaluate: ({ principal, rate, years }: FormulaInputs) => principal * (1 + (rate / 100) * years),
  },
  {
    id: "inflation",
    name: "Purchasing power",
    equation: "V = P ÷ (1 + r)ᵗ",
    description: "See what inflation does to the value of money you hold.",
    rateLabel: "Annual inflation",
    resultLabel: "Value in today's dollars",
    evaluate: ({ principal, rate, years }: FormulaInputs) => principal / (1 + rate / 100) ** years,
  },
];

export type ExampleFormula = (typeof EXAMPLE_FORMULAS)[number];
export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
