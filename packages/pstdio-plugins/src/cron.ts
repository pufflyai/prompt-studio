// Field ranges for 5-field cron: minute, hour, day-of-month, month, day-of-week.
// day-of-week: 0-7 where both 0 and 7 represent Sunday (POSIX convention).
const FIELD_RANGES: [string, number, number][] = [
  ["minute", 0, 59],
  ["hour", 0, 23],
  ["day-of-month", 1, 31],
  ["month", 1, 12],
  ["day-of-week", 0, 7],
];

const validateField = (token: string, min: number, max: number): boolean => {
  if (token === "*") return true;

  // Handle step: */N or range/N
  const [base, step] = token.split("/");
  if (step !== undefined) {
    const stepNum = Number(step);
    if (!Number.isInteger(stepNum) || stepNum < 1) return false;
    if (base === "*") return true;
    return validateField(base!, min, max);
  }

  // Handle list: 1,2,3
  if (token.includes(",")) {
    return token.split(",").every((part) => validateField(part, min, max));
  }

  // Handle range: 1-5
  if (token.includes("-")) {
    const [start, end] = token.split("-");
    const s = Number(start);
    const e = Number(end);
    return Number.isInteger(s) && Number.isInteger(e) && s >= min && s <= max && e >= min && e <= max;
  }

  // Single value
  const num = Number(token);
  return Number.isInteger(num) && num >= min && num <= max;
};

export const validateCronExpression = (cron: string, pluginIdentity: string, scheduleName: string) => {
  const fields = cron.trim().split(/\s+/);

  if (fields.length !== 5) {
    throw new Error(
      `Schedule "${scheduleName}" in plugin "${pluginIdentity}" must be a 5-field cron expression, got "${cron}"`,
    );
  }

  for (let i = 0; i < fields.length; i++) {
    const [fieldName, min, max] = FIELD_RANGES[i]!;
    if (!validateField(fields[i]!, min, max)) {
      throw new Error(
        `Schedule "${scheduleName}" in plugin "${pluginIdentity}" has invalid ${fieldName} field in cron "${cron}"`,
      );
    }
  }
};

export const cronMatchesTime = (cron: string, date: Date) => {
  const fields = cron.trim().split(/\s+/);
  const values = [
    date.getUTCMinutes(),
    date.getUTCHours(),
    date.getUTCDate(),
    date.getUTCMonth() + 1,
    date.getUTCDay(),
  ];

  return fields.every((field, i) => fieldMatchesValue(field!, values[i]!, FIELD_RANGES[i]![1], FIELD_RANGES[i]![2]));
};

const fieldMatchesValue = (field: string, value: number, min: number, max: number): boolean => {
  if (field === "*") return true;

  // Handle step
  const [base, step] = field.split("/");
  if (step !== undefined) {
    const stepNum = Number(step);
    if (base === "*") return (value - min) % stepNum === 0;
    // Range with step
    if (base!.includes("-")) {
      const [start, end] = base!.split("-").map(Number);
      return value >= start! && value <= end! && (value - start!) % stepNum === 0;
    }
    return value % stepNum === 0;
  }

  // Handle list
  if (field.includes(",")) {
    return field.split(",").some((part) => fieldMatchesValue(part, value, min, max));
  }

  // Handle range
  if (field.includes("-")) {
    const [start, end] = field.split("-").map(Number);
    return value >= start! && value <= end!;
  }

  return Number(field) === value;
};
