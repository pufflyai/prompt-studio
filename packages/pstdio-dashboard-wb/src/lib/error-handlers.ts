export const logMutationError = (label: string, error: unknown) => {
  console.error(`[${label}]`, error);
};
