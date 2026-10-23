import { join } from "node:path";
import { type BenchmarkSuite, runsOn, type SuiteContext, type SuiteStep, suites } from "./suites";
import { RESULTS_FILE_ENV } from "./writer";

export const currentPlatform = () => `${process.platform}-${process.arch}`;

export const findSuites = (ids: string[], platform: string) =>
  ids.flatMap((id) => {
    const suite = suites.find((entry) => entry.id === id);
    return suite && runsOn(suite.platforms, platform) ? [suite] : [];
  });

const runStep = async (context: SuiteContext, step: SuiteStep, env: Record<string, string> = {}) => {
  if (!runsOn(step.platforms, context.platform)) return true;
  const cwd = join(context.root, step.cwd ?? "");
  console.info(`$ ${step.command.join(" ")}  (in ${step.cwd ?? "."})`);
  const child = Bun.spawn(step.command, {
    cwd,
    env: { ...process.env, ...step.env, ...env },
    stdio: ["ignore", "inherit", "inherit"],
  });
  return (await child.exited) === 0;
};

// Every step runs even after one fails, so one broken benchmark does not hide the others.
const runSteps = async (context: SuiteContext, steps: SuiteStep[], env?: Record<string, string>) => {
  let passed = true;
  for (const step of steps) passed = (await runStep(context, step, env)) && passed;
  return passed;
};

export const prepareSuite = (context: SuiteContext, suite: BenchmarkSuite) =>
  runSteps(context, suite.prepare?.(context) ?? []);

export const sampleSuite = (context: SuiteContext, suite: BenchmarkSuite, resultsFile: string) =>
  runSteps(context, suite.sample(context), { [RESULTS_FILE_ENV]: resultsFile });
