import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { acquireFileMutationLock } from "pstdio-paths";
import { accessRequest, type IdentityMode } from "./client-identity";
import { serviceUrl, sessionSchema } from "./config";
import { applySession, clearConnections, type LocalRuntime } from "./host-setup";
import { installExtensions } from "./install";
import { supervise } from "./supervisor";

type ClientOptions = { broker: string; audience: string; mode: IdentityMode; runId?: string };
export async function openPreview(options: ClientOptions, workspaceId: string) {
  const result = await accessRequest({ ...options, path: "/v1/preview", body: { workspaceId, runId: options.runId } });
  if (new URL(result.url).protocol !== "https:" || !Number.isFinite(Date.parse(result.expiresAt)))
    throw new Error("Invalid preview link.");
  return { url: result.url as string, expiresAt: result.expiresAt as string };
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    strict: true,
    options: {
      broker: { type: "string" },
      audience: { type: "string" },
      identity: { type: "string", default: "gcloud" },
      root: { type: "string", default: process.cwd() },
      checkout: { type: "string" },
      "run-id": { type: "string" },
      login: { type: "boolean", default: false },
      "grant-file": { type: "string" },
    },
  });
  if (!values.broker || !["gcloud", "metadata"].includes(values.identity!))
    throw new Error(
      "Usage: cloud-access <connect|register|revoke|preview> --broker https://access.example.com --identity gcloud|metadata [--run-id UUID] [--root PROJECT] [--checkout SOURCE] [--login]",
    );
  const options: ClientOptions = {
    broker: serviceUrl.parse(values.broker),
    audience: values.audience ?? values.broker,
    mode: values.identity as IdentityMode,
    runId: values["run-id"],
  };
  const action = positionals[0] ?? "connect";
  if (values.login) {
    if (options.mode !== "gcloud") throw new Error("Workload identity never uses interactive login.");
    const login = Bun.spawn(["gcloud", "auth", "login"], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    if (await login.exited) throw new Error("Google sign-in failed.");
  }
  if (action === "register") {
    if (!values["grant-file"]) throw new Error("Pass --grant-file with the launcher's trusted run record.");
    const body = JSON.parse(await readFile(values["grant-file"], "utf8"));
    console.log(JSON.stringify(await accessRequest({ ...options, path: "/v1/runs", body })));
    return;
  }
  if (action === "revoke") {
    if (!options.runId) throw new Error("Pass --run-id.");
    console.log(
      JSON.stringify(await accessRequest({ ...options, path: `/v1/runs/${options.runId}`, method: "DELETE" })),
    );
    return;
  }
  if (action === "preview") {
    if (!positionals[1]) throw new Error("Pass a workspace ID.");
    console.log(JSON.stringify(await openPreview(options, positionals[1])));
    return;
  }
  if (action !== "connect") throw new Error("Unknown cloud access command.");

  await connect(options, resolve(values.root!), values.checkout);
}

async function connect(options: ClientOptions, root: string, sourceCheckout?: string) {
  const home = resolve(process.env.PSTDIO_HOME ?? join(homedir(), ".pstdio"));
  const release = acquireFileMutationLock(join(home, "cloud-access", "supervisor"), "cloud access supervisor");
  try {
    await connectOwned(options, root, home, sourceCheckout);
  } finally {
    release();
  }
}

async function connectOwned(options: ClientOptions, root: string, home: string, sourceCheckout?: string) {
  const { project_id: projectId } = JSON.parse(await readFile(join(root, ".pstdio/config.json"), "utf8"));
  const runtime = () => Bun.file(join(home, "runtime.json")).json() as Promise<LocalRuntime>;
  // Authenticate before changing this machine's extensions or connections.
  const session = () =>
    accessRequest({ ...options, path: "/v1/session", body: { runId: options.runId } }).then((value) =>
      sessionSchema.parse(value),
    );
  let initial: Awaited<ReturnType<typeof session>> | undefined = await session();
  const checkout = resolve(sourceCheckout ?? join(import.meta.dir, "../../.."));
  await installExtensions({ root, checkout, home, runtime: await runtime(), projectId });
  const helper = join(home, "cloud-access", "preview.ts");
  await mkdir(dirname(helper), { recursive: true, mode: 0o700 });
  // The helper contains public connection coordinates only, never a credential.
  await writeFile(
    helper,
    `import { openPreview } from ${JSON.stringify(import.meta.path)};\nconsole.log(JSON.stringify(await openPreview(${JSON.stringify(options)}, Bun.argv[2])));\n`,
    { mode: 0o600 },
  );
  const stop = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => stop.abort());
  await supervise({
    signal: stop.signal,
    session: async () => {
      if (initial) {
        const value = initial;
        initial = undefined;
        return value;
      }
      return session();
    },
    apply: async (value) => {
      await applySession({
        root,
        projectId,
        runtime: await runtime(),
        session: value,
        previewHelper: helper,
        googleAuthentication: "broker",
      });
      console.log(`Cloud access connected until ${value.expiresAt}.`);
    },
    clear: async () => clearConnections(await runtime(), projectId),
    warn: (message) => console.error(message),
  });
}

if (import.meta.main)
  main().catch(() => {
    console.error(
      "Cloud access failed. Check the command arguments, Google sign-in, service policy and Prompt Studio runtime.",
    );
    process.exitCode = 1;
  });
