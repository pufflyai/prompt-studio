import { mkdir } from "node:fs/promises";
import { probeManifest, probeSource } from "./probe";
import { until } from "./process";
import type { WorkspaceConfig } from "./types";

const directory = "/workspace/cloud-team";
await mkdir(directory, { recursive: true, mode: 0o700 });
const config = await until(
  "operator configuration",
  async () =>
    (await Bun.file(`${directory}/config.json`).exists()) &&
    ((await Bun.file(`${directory}/config.json`).json()) as WorkspaceConfig),
  600,
);
await Bun.write(`${directory}/ca.pem`, config.cert);
if (config.role === "owner") await Bun.write(`${directory}/key.pem`, config.key);
const home = `${directory}/home`;
await mkdir(`${home}/.pstdio`, { recursive: true });
const env = {
  ...process.env,
  HOME: home,
  PSTDIO_HOME: `${home}/.pstdio`,
  PSTDIO_DB_PATH: `${home}/.pstdio/data`,
  PSTDIO_DISABLE_EMBED_MANIFEST: "1",
  PSTDIO_DEFAULT_EXTENSIONS: "[]",
  NODE_EXTRA_CA_CERTS: `${directory}/ca.pem`,
};
const children: Bun.Subprocess[] = [];
let lifetime: ReturnType<typeof setTimeout> | undefined;
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
  await Promise.all(
    children.map(async (child) => {
      const stopped = await Promise.race([child.exited.then(() => true), Bun.sleep(15_000).then(() => false)]);
      if (!stopped) {
        child.kill("SIGKILL");
        await child.exited;
      }
    }),
  );
};
process.once("SIGTERM", () => {
  void close();
});
process.once("SIGINT", () => {
  void close();
});
try {
  if (config.role === "owner") {
    await until(
      "owned storage network",
      async () =>
        (
          await fetch(`${config.objectEndpoint}/health`, {
            signal: AbortSignal.timeout(3000),
          }).catch(() => null)
        )?.ok,
    );
    children.push(
      Bun.spawn(["bun", "services/account-manager/scripts/cloud-team.ts"], {
        env,
        stdout: "inherit",
        stderr: "inherit",
      }),
    );
    await until("real manager", async () => {
      const response = await fetch(`${config.managerOrigin}/health`, { tls: { ca: config.cert } }).catch(() => null);
      return response?.ok;
    });
    children.push(
      Bun.spawn(["bun", "services/relay/scripts/cloud-team.ts"], { env, stdout: "inherit", stderr: "inherit" }),
    );
  }
  children.push(
    Bun.spawn(
      [
        "bun",
        "--conditions=source",
        "packages/pstdio/src/index.ts",
        "serve",
        "--foreground",
        "--host",
        "127.0.0.1",
        "--port",
        "3030",
        "--owner",
        "persistent",
      ],
      { env, stdout: "inherit", stderr: "inherit" },
    ),
  );
  await until("native runtime", async () => {
    const runtime = await Bun.file(`${home}/.pstdio/runtime.json`)
      .json()
      .catch(() => null);
    if (!runtime?.token) return false;
    return (
      await fetch("http://127.0.0.1:3030/readyz", { headers: { authorization: `Bearer ${runtime.token}` } }).catch(
        () => null,
      )
    )?.ok;
  });
  if (config.role === "owner") {
    await mkdir(`${directory}/probe`, { recursive: true });
    await Bun.write(`${directory}/probe/package.json`, JSON.stringify(probeManifest));
    await Bun.write(`${directory}/probe/extension.ts`, probeSource);
  }
  await Bun.write(`${directory}/ready`, config.role);
  console.log(`CLOUD_TEAM_READY ${config.role}`);
  const remaining = Math.max(0, Date.parse(config.deadline) - Date.now());
  await Promise.race([
    ...children.map(async (child) => {
      throw new Error(`Owned service exited (${await child.exited})`);
    }),
    new Promise<void>((resolve) => {
      lifetime = setTimeout(resolve, remaining);
    }),
  ]);
} finally {
  clearTimeout(lifetime);
  await close();
}
