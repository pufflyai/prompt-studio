import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const environment = "production";
const directory = import.meta.dir;
await mkdir(join(directory, "secrets"), { recursive: true, mode: 0o700 });
await mkdir(join(directory, "generated"), { recursive: true });
for (const [name, owner] of [
  ["prometheus", 65534],
  ["loki", 10001],
  ["alertmanager", 65534],
  ["caddy", 0],
  ["alloy", 0],
  ["checkpoint", 1000],
] as const) {
  const path = join(directory, "state", name);
  await mkdir(path, { recursive: true, mode: 0o700 });
  // On Linux an operator must chown these directories to the printed image UIDs before first start.
  console.log(`State directory ${name}: container uid ${owner}`);
}
const path = join(directory, "secrets/gateway.json");
let credentials: { readToken: string; metricsToken: string; logsToken: string };
try {
  credentials = JSON.parse(await readFile(path, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT")
    throw new Error("Existing gateway configuration is unreadable");
  credentials = {
    readToken: crypto.randomUUID() + crypto.randomUUID(),
    metricsToken: crypto.randomUUID() + crypto.randomUUID(),
    logsToken: crypto.randomUUID() + crypto.randomUUID(),
  };
  await writeFile(
    path,
    JSON.stringify({
      environment,
      ...credentials,
      metricsOrigin: "http://prometheus:9090",
      logsOrigin: "http://loki:3100",
      alertsOrigin: "http://alertmanager:9093",
    }),
    { mode: 0o600, flag: "wx" },
  );
}
await chmod(path, 0o600);
const rules = (await readFile(join(directory, "rules.yaml"), "utf8")).replaceAll("__ENVIRONMENT__", environment);
await writeFile(join(directory, "generated/rules.yaml"), rules);
await writeFile(
  join(directory, "secrets/connection.json"),
  JSON.stringify({
    name: `monitoring-${environment}`,
    baseUrl: process.env.MONITORING_QUERY_ORIGIN ?? "http://127.0.0.1:9460",
    bearerToken: credentials.readToken,
  }),
  { mode: 0o600 },
);
console.log("Wrote private connection files and rules. Configure receivers and verify mounts before starting.");
