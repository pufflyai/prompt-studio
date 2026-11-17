import process from "node:process";

// Keep argument construction shared while each host retains its native tool PATH.
const env = process.env;
const command = env.LERNA_FILTER
  ? [process.execPath, "scripts/ci/run-package-group.ts"]
  : [process.execPath, "scripts/test.ts", "--plan", "test-results/ci/plan.json", "--job", env.PLAN_JOB!];
if (!env.LERNA_FILTER && env.PLAN_PREBUILT === "true") command.push("--prebuilt");
const child = Bun.spawn(command, {
  stdio: ["inherit", "inherit", "inherit"],
  env: { ...env, ...(env.LERNA_FILTER ? { CI_PLAN_JOB: env.PLAN_JOB } : {}) },
});
let interrupted = false;
const forward = (signal: NodeJS.Signals) => {
  interrupted = true;
  child.kill(signal);
};
const stop = () => forward("SIGTERM");
const interrupt = () => forward("SIGINT");
process.on("SIGTERM", stop);
process.on("SIGINT", interrupt);
try {
  const exitCode = await child.exited;
  process.exitCode = interrupted ? 1 : exitCode;
} finally {
  process.off("SIGTERM", stop);
  process.off("SIGINT", interrupt);
}
