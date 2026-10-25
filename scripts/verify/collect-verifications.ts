export const collectVerifications = async (
  checks: Array<{ id: string; run: () => unknown | Promise<unknown> }>,
  report: (error: string) => void = (error) => console.error(`::error::${error}`),
  priority = process.env.CI_PRIORITY ?? "P2",
) => {
  const errors: string[] = [];
  for (const check of checks) {
    try {
      console.log(`[${new Date().toISOString()}] ${check.id}`);
      await check.run();
    } catch (error) {
      const message = `${check.id}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(message);
      report(message);
      if (priority === "P1") break;
    }
  }
  return errors;
};
