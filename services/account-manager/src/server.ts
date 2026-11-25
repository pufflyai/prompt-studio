import { createServiceMonitoring, createServiceTelemetry, type ServiceFailure } from "pstdio-service-telemetry";
import { createManagerAuthentication } from "./manager-authentication";
import { createManagerHandler } from "./manager-http";

const number = (name: string) => Number(process.env[name]);
const telemetry = createServiceTelemetry(process.env, "manager");
const monitoring = createServiceMonitoring(process.env, "manager");
const report = (code: ServiceFailure) => {
  telemetry.report(code);
  monitoring.failure(code);
};
const auth = createManagerAuthentication({
  databaseUrl: process.env.DATABASE_URL ?? "",
  databasePoolMax: process.env.DATABASE_POOL_MAX === undefined ? undefined : number("DATABASE_POOL_MAX"),
  origin: process.env.MANAGER_ORIGIN ?? "",
  audience: process.env.RELAY_AUDIENCE ?? "",
  secret: process.env.BETTER_AUTH_SECRET ?? "",
  projectDeletionRelayToken: process.env.PROJECT_DELETION_RELAY_TOKEN || undefined,
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  sessionLifetimeSeconds: number("SESSION_LIFETIME_SECONDS"),
  sessionUpdateAgeSeconds: number("SESSION_UPDATE_AGE_SECONDS"),
  accessLifetimeSeconds: number("ACCESS_LIFETIME_SECONDS"),
});
const certificate = process.env.MANAGER_TLS_CERT;
const key = process.env.MANAGER_TLS_KEY;
const port = Number(process.env.MANAGER_PORT ?? "8443");
if (!Number.isInteger(port) || port < 0 || port > 65535 || Boolean(certificate) !== Boolean(key))
  throw new Error("Invalid manager listener configuration");
const server = Bun.serve({
  hostname: process.env.MANAGER_HOST ?? "127.0.0.1",
  port,
  ...(certificate && key ? { tls: { cert: Bun.file(certificate), key: Bun.file(key) } } : {}),
  fetch: monitoring.wrap(createManagerHandler(auth, process.env.MANAGER_ORIGIN!, undefined, report)),
});
let closing: Promise<void> | undefined;
const close = () =>
  (closing ??= (async () => {
    try {
      await server.stop();
      await auth.close();
    } finally {
      telemetry.close();
      await monitoring.close();
      console.log(JSON.stringify({ event: "telemetry.delivery", service: "manager", ...telemetry.counts() }));
    }
  })());
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void close().catch(() => {
      process.exitCode = 1;
    });
  });
console.log(`Account manager listening on ${server.url.origin}`);
