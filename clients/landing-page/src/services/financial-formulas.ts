export type FormulaValues = Record<string, number>;
export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

const annuity = (rate: number, periods: number) => (rate === 0 ? periods : ((1 + rate) ** periods - 1) / rate);
const sample = (years: number, calculate: (year: number) => number) =>
  Array.from({ length: 101 }, (_, index) => calculate((years * index) / 100));

const savings = (inputs: FormulaValues) => {
  const { principal, monthly, rate, years, inflation } = inputs;
  const monthlyRate = rate / 1200;
  const balance = (year: number) =>
    principal * (1 + monthlyRate) ** (year * 12) + monthly * annuity(monthlyRate, year * 12);
  const value = balance(years);
  const contributed = principal + monthly * years * 12;
  return {
    value,
    metrics: [
      { label: "Contributed", value: contributed },
      { label: "Growth", value: value - contributed },
      { label: "Today's purchasing power", value: value / (1 + inflation / 100) ** years },
    ],
    values: sample(years, balance),
    comparison: sample(years, (year) => principal + monthly * year * 12),
    chartLabel: "Projected balance",
    comparisonLabel: "Contributions",
  };
};

const loan = (inputs: FormulaValues) => {
  const { principal, rate, years } = inputs;
  const monthlyRate = rate / 1200;
  const periods = years * 12;
  const value = (principal * (1 + monthlyRate) ** periods) / annuity(monthlyRate, periods);
  const remaining = (year: number) =>
    Math.max(0, principal * (1 + monthlyRate) ** (year * 12) - value * annuity(monthlyRate, year * 12));
  return {
    value,
    metrics: [
      { label: "Total interest", value: value * periods - principal },
      { label: "Total repaid", value: value * periods },
    ],
    values: sample(years, remaining),
    comparison: sample(years, (year) => principal * (1 - year / years)),
    chartLabel: "Loan balance",
    comparisonLabel: "At 0% interest",
  };
};

const discountedCashFlow = (inputs: FormulaValues) => {
  const { principal, cashFlow, growth, rate, years } = inputs;
  let discounted = -principal;
  let nominal = -principal;
  const values = [discounted];
  const comparison = [nominal];
  for (let year = 1; year <= years; year++) {
    const income = cashFlow * (1 + growth / 100) ** (year - 1);
    discounted += income / (1 + rate / 100) ** year;
    nominal += income;
    values.push(discounted);
    comparison.push(nominal);
  }
  return {
    value: discounted,
    metrics: [
      { label: "Present value of cash flows", value: discounted + principal },
      { label: "Upfront cost", value: principal },
    ],
    values,
    comparison,
    chartLabel: "Discounted cash flow",
    comparisonLabel: "Undiscounted",
  };
};

const CALCULATORS = { savings, loan, dcf: discountedCashFlow };
export type FormulaId = keyof typeof CALCULATORS;
export const calculateFormula = (id: FormulaId, inputs: FormulaValues) => CALCULATORS[id](inputs);
export type FormulaResult = ReturnType<typeof calculateFormula>;
export const executeFormulaCommand = (id: FormulaId, inputs: FormulaValues) => ({
  command: `finance.${id}`,
  arguments: { ...inputs },
  result: calculateFormula(id, inputs),
});
