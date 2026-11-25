// The relay owns availability. Its optional, co-located collector cannot stop it.
const server = Bun.spawn(process.argv.slice(2), { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
let collector: ReturnType<typeof Bun.spawn> | undefined;
let stopping = false;
const stop = () => {
  stopping = true;
  server.kill("SIGTERM");
  collector?.kill("SIGTERM");
};
process.once("SIGTERM", stop);
process.once("SIGINT", stop);

const collect = async () => {
  if (!process.env.METRICS_WRITE_URL || !process.env.LOGS_WRITE_URL) return;
  // The collector only needs its targets and write credentials, never DB, account or S3 secrets.
  const names = [
    "PATH",
    "HOME",
    "MONITORING_ENVIRONMENT",
    "METRICS_WRITE_URL",
    "METRICS_WRITE_TOKEN",
    "LOGS_WRITE_URL",
    "LOGS_WRITE_TOKEN",
    "RELAY_METRICS_TARGET",
    "MANAGER_METRICS_TARGET",
  ];
  const env = {
    ...Object.fromEntries(names.flatMap((key) => (process.env[key] === undefined ? [] : [[key, process.env[key]!]]))),
    GOMEMLIMIT: "32MiB",
  };
  while (!stopping) {
    try {
      collector = Bun.spawn(
        [
          "alloy",
          "run",
          "--server.http.listen-addr=127.0.0.1:12345",
          "--storage.path=/tmp/monitoring-collector",
          "/etc/alloy/config.alloy",
        ],
        { env, stdin: "ignore", stdout: "inherit", stderr: "inherit" },
      );
      await collector.exited;
    } catch {
      console.error("Optional monitoring collector unavailable");
    }
    collector = undefined;
    if (!stopping) await Bun.sleep(1000);
  }
};
const collection = collect();
try {
  process.exitCode = await server.exited;
} finally {
  stopping = true;
  const active = collector;
  active?.kill("SIGTERM");
  const kill = setTimeout(() => active?.kill("SIGKILL"), 1000);
  kill.unref();
  try {
    await collection;
  } finally {
    clearTimeout(kill);
  }
  process.off("SIGTERM", stop);
  process.off("SIGINT", stop);
}
