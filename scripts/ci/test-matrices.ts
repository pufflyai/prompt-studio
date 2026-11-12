import type { TestPlan } from "./test-plan";

// Projection assigns immutable run IDs. It never discovers or selects tests.
export const projectCiJobs = (plan: TestPlan) => {
  const jobs = new Map<string, string[]>();
  for (const run of plan.runs) {
    if (!run.job) throw new Error(`Missing CI job assignment: ${run.id}`);
    jobs.set(run.job, [...(jobs.get(run.job) ?? []), run.id]);
  }
  return Object.fromEntries(jobs);
};
