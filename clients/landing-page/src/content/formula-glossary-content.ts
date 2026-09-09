import { type FormulaId, type FormulaResult, type FormulaValues, formatMoney } from "../services/financial-formulas";

interface FormulaControl {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: "money" | "percent" | "years";
}

export interface ExampleFormula {
  id: FormulaId;
  name: string;
  equation: string;
  description: string;
  resultLabel: string;
  defaults: FormulaValues;
  controls: FormulaControl[];
  question: (inputs: FormulaValues) => string;
  answer: (inputs: FormulaValues, result: FormulaResult) => string;
}

export const EXAMPLE_FORMULAS: ExampleFormula[] = [
  {
    id: "savings",
    name: "Savings with contributions",
    equation: "FV = P(1+i)ⁿ + C[(1+i)ⁿ−1]/i",
    description:
      "Monthly deposits, compound returns, and inflation in one model. i is the monthly rate; n is the number of months.",
    resultLabel: "Projected balance",
    defaults: { principal: 10000, monthly: 300, rate: 6, years: 15, inflation: 2.5 },
    controls: [
      { key: "principal", label: "Starting amount", min: 1000, max: 100000, step: 1000, unit: "money" },
      { key: "monthly", label: "Monthly contribution", min: 0, max: 2000, step: 50, unit: "money" },
      { key: "rate", label: "Annual return", min: 0, max: 15, step: 0.5, unit: "percent" },
      { key: "years", label: "Time", min: 1, max: 30, step: 1, unit: "years" },
      { key: "inflation", label: "Annual inflation", min: 0, max: 8, step: 0.5, unit: "percent" },
    ],
    question: (v) =>
      `What could ${formatMoney(v.principal)} plus ${formatMoney(v.monthly)} a month grow to in ${v.years} years at ${v.rate}%? Account for ${v.inflation}% inflation.`,
    answer: (_v, r) =>
      `The model gives ${formatMoney(r.value)}: ${formatMoney(r.metrics[0].value)} contributed and ${formatMoney(r.metrics[1].value)} in growth. With inflation, that is ${formatMoney(r.metrics[2].value)} in today's dollars.`,
  },
  {
    id: "loan",
    name: "Loan amortization",
    equation: "M = Pi(1+i)ⁿ / [(1+i)ⁿ−1]",
    description:
      "Calculate a fixed monthly payment and see the balance fall. i is the monthly interest rate; n is the number of payments.",
    resultLabel: "Monthly payment",
    defaults: { principal: 250000, rate: 5.5, years: 25 },
    controls: [
      { key: "principal", label: "Loan amount", min: 10000, max: 500000, step: 10000, unit: "money" },
      { key: "rate", label: "Annual interest", min: 0, max: 15, step: 0.25, unit: "percent" },
      { key: "years", label: "Loan term", min: 1, max: 30, step: 1, unit: "years" },
    ],
    question: (v) =>
      `For a ${formatMoney(v.principal)} loan at ${v.rate}% over ${v.years} years, what is the monthly payment and total interest?`,
    answer: (v, r) =>
      `The monthly payment is ${formatMoney(r.value)} across ${v.years * 12} payments. Total interest is ${formatMoney(r.metrics[0].value)}, for ${formatMoney(r.metrics[1].value)} repaid. This model excludes fees and taxes.`,
  },
  {
    id: "dcf",
    name: "Discounted cash flow",
    equation: "NPV = −I₀ + Σ CF₁(1+g)ᵗ⁻¹/(1+r)ᵗ",
    description: "Compare an upfront cost with future cash flows. g is annual growth; r is the discount rate.",
    resultLabel: "Net present value",
    defaults: { principal: 50000, cashFlow: 14000, growth: 4, rate: 8, years: 7 },
    controls: [
      { key: "principal", label: "Upfront cost", min: 10000, max: 100000, step: 5000, unit: "money" },
      { key: "cashFlow", label: "First-year cash flow", min: 1000, max: 50000, step: 1000, unit: "money" },
      { key: "growth", label: "Annual cash flow growth", min: 0, max: 15, step: 0.5, unit: "percent" },
      { key: "rate", label: "Discount rate", min: 0, max: 20, step: 0.5, unit: "percent" },
      { key: "years", label: "Forecast period", min: 1, max: 15, step: 1, unit: "years" },
    ],
    question: (v) =>
      `What is the net present value of ${v.years} years of cash flows starting at ${formatMoney(v.cashFlow)}, growing ${v.growth}% a year, against a ${formatMoney(v.principal)} cost and a ${v.rate}% discount rate?`,
    answer: (_v, r) =>
      `Discounted cash flows total ${formatMoney(r.metrics[0].value)}. Subtracting the ${formatMoney(r.metrics[1].value)} upfront cost gives a net present value of ${formatMoney(r.value)}.`,
  },
];
