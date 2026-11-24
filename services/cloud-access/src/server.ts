import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createAccessService } from "./access";
import { parseConfig } from "./config";
import { createController } from "./controller";
import { createGoogleStorageSigner } from "./google-storage";
import { createGrantStore } from "./grants";
import { createIdentityVerifier } from "./identity";
import { createSocketIssuer } from "./issuer";
import { createStorageAccess, loadStorageSigningKey } from "./storage-access";

const configPath = process.env.CLOUD_ACCESS_CONFIG;
const issuerPath = process.env.CLOUD_ACCESS_ISSUER_FILE;
const adminSocket = process.env.CLOUD_ACCESS_ADMIN_SOCKET;
const statePath = process.env.CLOUD_ACCESS_STATE;
if (!configPath || !statePath || Boolean(issuerPath) === Boolean(adminSocket))
  throw new Error(
    "Set CLOUD_ACCESS_CONFIG, CLOUD_ACCESS_STATE and exactly one of CLOUD_ACCESS_ISSUER_FILE or CLOUD_ACCESS_ADMIN_SOCKET.",
  );
const config = () => parseConfig(JSON.parse(readFileSync(configPath, "utf8")));
const initial = config();
const fileIssuer = async () => {
  // Read on issuance so an operator can rotate the central authority without restarting.
  const value = (await readFile(issuerPath!, "utf8")).trim();
  return value.startsWith("{") ? (JSON.parse(value).token as string) : value;
};
const issuer = adminSocket
  ? createSocketIssuer(adminSocket, { minimumValidityMs: initial.sessionSeconds * 1000 })
  : fileIssuer;
const controller = createController(initial.controllerUrl, issuer);
const store = await createGrantStore(statePath);
const storage = createStorageAccess({
  issuer: initial.audience,
  key: await loadStorageSigningKey(join(statePath, "storage-signing.key")),
  sign: createGoogleStorageSigner(initial.settings),
});
const service = createAccessService({
  config,
  controller,
  store,
  storage,
  verify: createIdentityVerifier(initial),
  async preview(id, deadline) {
    const helper = config().previewHelper;
    if (!helper) throw new Error("Preview access is unavailable.");
    const child = Bun.spawn(["bun", helper, id, deadline], { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
    const timeout = setTimeout(() => child.kill(), 45_000);
    try {
      const output = await new Response(child.stdout).text();
      if ((await child.exited) || output.length > 16384) throw new Error("Preview access is unavailable.");
      const value = JSON.parse(output);
      if (
        new URL(value.url).protocol !== "https:" ||
        !Number.isFinite(Date.parse(value.expiresAt)) ||
        Date.parse(value.expiresAt) <= Date.now()
      )
        throw new Error("Invalid preview URL.");
      return { url: value.url as string, expiresAt: value.expiresAt as string };
    } finally {
      clearTimeout(timeout);
    }
  },
});
await store.cleanup();
const cleanup = setInterval(() => void store.cleanup().catch(() => console.error("Grant cleanup failed.")), 3600_000);
const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 8090),
  maxRequestBodySize: 16384,
  fetch: service.fetch,
});
console.log(`Cloud access listening on ${server.hostname}:${server.port}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    clearInterval(cleanup);
    void server.stop();
  });
