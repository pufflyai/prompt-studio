import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readPackageManifestMetadata } from "pstdio-extensions";
import { resolveIsolatedHome } from "./dev-isolated";
import {
  type LocalRelayConnection,
  localGrantNeedsEnrollment,
  sameRelayOwner,
  upsertLocalRelayConnection,
} from "./relay-local-config";

const root = resolve(import.meta.dir, "../..");
const name = process.argv.find((value) => value.startsWith("--name="))?.slice(7) ?? "relay-local";
if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) throw new Error("Invalid local relay name");
const directory = join(root, "__test-tmp__", "relay", name);
const project = `${name}-relay`;
const apps = [`${name}-a`, `${name}-b`];
const network = `${project}_default`;
const certificate = join(directory, "trust.pem");
const env = {
  ...process.env,
  PSTDIO_ISOLATED_COMPOSE_FILE: "infra/local/compose.relay.yaml",
  PSTDIO_RELAY_NETWORK: network,
  PSTDIO_RELAY_PROJECT: project,
  PSTDIO_RELAY_CA_FILE: certificate,
  PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
    defaultExtensions: [
      {
        source: join(root, "extensions/pstdio-base-themes"),
        installName: "pstdio-base-themes",
        force: true,
        skipInstall: true,
      },
      ...["pstdio-notes", "pstdio-artifacts", "harness-codex", "harness-claude-code", "harness-open-code"].map(
        (installName) => ({ source: join(root, "extensions", installName), installName, force: false }),
      ),
      { source: join(root, "infra/local/extensions/relay-demo"), installName: "relay-demo", force: true },
    ],
  }),
};
const compose = [
  "docker",
  "compose",
  "-p",
  project,
  "-f",
  "infra/relay/compose.test.yaml",
  "-f",
  "infra/relay/compose.local.yaml",
];
const run = async (args: string[], options: { capture?: boolean; input?: string } = {}) => {
  const child = Bun.spawn(args, {
    cwd: root,
    env,
    stdin: options.input === undefined ? "ignore" : "pipe",
    stdout: options.capture ? "pipe" : "inherit",
    stderr: "inherit",
  });
  if (options.input !== undefined) {
    child.stdin!.write(options.input);
    child.stdin!.end();
  }
  const output = options.capture ? new Response(child.stdout).text() : Promise.resolve("");
  const status = await child.exited;
  const text = await output;
  if (status !== 0) throw new Error(`Local relay command failed (${status}): ${args[0]}`);
  return text;
};
const studio = (app: string, args: string[] = []) => run(["bun", "run", "dev:isolated", "--", "--name", app, ...args]);
const docker = (...args: string[]) => run([...compose, ...args]);

if (process.argv.includes("--down")) {
  for (const app of apps) await studio(app, ["--down"]);
  // The profile includes the test-only services, so their volumes are removed too.
  await docker("--profile", "test", "down", "--volumes", "--remove-orphans");
  await run(["docker", "volume", "rm", `${project}-app-deps`]);
  await rm(directory, { recursive: true, force: true });
  console.log(`Stopped ${name} and removed its isolated data`);
} else {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await docker("build", "relay", "authority", "initialize", "tls");
  const previousTrust = await Bun.file(certificate)
    .text()
    .catch(() => null);
  const refreshTls = await run([...compose, "run", "--rm", "--no-deps", "tls", "bun", "tls.fixture.ts", "--check"], {
    capture: true,
  }).then(
    () => false,
    () => true,
  );
  if (refreshTls) {
    await docker("run", "--rm", "--no-deps", "tls");
  }
  await docker("up", "--wait", "postgres", "objects");
  // The bucket and bootstrap scope belong only to this named fixture.
  await run([...compose, "run", "--rm", "--no-deps", "bucket"], { capture: true }).catch(async () => {
    await docker(
      "run",
      "--rm",
      "--no-deps",
      "bucket",
      "--endpoint-url",
      "http://objects:9000",
      "s3api",
      "head-bucket",
      "--bucket",
      "relay-test",
    );
  });
  await docker(
    "run",
    "--rm",
    "--no-deps",
    "initialize",
    "bun",
    "-e",
    "if (!await Bun.file('/fixture/grant.json').exists()) await import('/app/initialize.js')",
  );
  await docker("run", "--rm", "--no-deps", "initialize", "bun", "/app/recovery-key.js");
  await docker("up", "--wait", ...(refreshTls ? ["--force-recreate"] : []), "authority", "relay");
  await docker("cp", "authority:/tls-public/trust.pem", certificate);
  const trustChanged = previousTrust !== (await Bun.file(certificate).text());
  for (const suffix of ["app-deps"])
    await run(["docker", "volume", "create", "--label", `pstdio.local-relay=${name}`, `${project}-${suffix}`], {
      capture: true,
    });
  for (const app of apps) {
    const home = resolveIsolatedHome(root, app);
    const configPath = join(home, "relay.json");
    await mkdir(home, { recursive: true });
    if (!(await Bun.file(configPath).exists()))
      await writeFile(configPath, JSON.stringify({ connections: [] }), { mode: 0o600 });
    await studio(app);
    const connection = JSON.parse(await readFile(join(home, "..", "connection.json"), "utf8")) as {
      apiPort: number;
      apiToken: string;
      dashboardUrl: string;
    };
    const api = async (path: string, method = "GET", body?: unknown) => {
      const response = await fetch(`http://127.0.0.1:${connection.apiPort}/v1/${path}`, {
        method,
        headers: { authorization: `Bearer ${connection.apiToken}`, "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw new Error(`Local app setup failed (${response.status})`);
      return response.json();
    };
    const identity = (await api("environment")) as { environmentId: string };
    const scope = {
      accountId: "built-network-account",
      workbenchId: "built-network-workbench",
    };
    await run(["docker", "exec", `${app}-prompt-studio-1`, "mkdir", "-p", "/workspace/project/shared"]);
    await api(`projects/${scope.workbenchId}/environment-binding`, "PUT", {
      environmentId: identity.environmentId,
      name: "Shared relay",
      initial_workspace: { provider_id: "pstdio.root", params: { path: "/workspace/project/shared" } },
    });
    await api("agents/info");
    for (const installName of [
      "pstdio-base-themes",
      "pstdio-notes",
      "pstdio-artifacts",
      "harness-codex",
      "harness-claude-code",
      "harness-open-code",
      "relay-demo",
    ]) {
      const sourcePath = join(home, "extensions", installName);
      const { manifest } = readPackageManifestMetadata(sourcePath);
      if (!manifest) throw new Error(`Missing installed extension: ${installName}`);
      await api(`projects/${scope.workbenchId}/extensions/installed/${installName}/enable`, "POST", {
        displayName: manifest.displayName ?? manifest.name,
        extensionId: manifest.id,
        manifest,
        name: manifest.name,
        sourcePath,
        sourceKind: "local_path",
        version: manifest.version,
      });
    }
    const existing = JSON.parse(await readFile(configPath, "utf8")) as { connections: LocalRelayConnection[] };
    const saved = existing.connections.find((item) =>
      sameRelayOwner(item, { ...scope, environmentId: identity.environmentId }),
    );
    let enroll = !saved;
    if (saved) {
      const probe = JSON.parse(
        await run(
          [
            ...compose,
            "exec",
            "-T",
            "authority",
            "bun",
            "-e",
            "const input=await Bun.stdin.json(); const response=await fetch('https://authority:8443/v1/environment-access',{method:'POST',tls:{ca:await Bun.file('/tls-public/trust.pem').text()},headers:{authorization:'Bearer '+input.grant,'content-type':'application/json'},body:JSON.stringify({workbenchId:input.workbenchId})}); await response.body?.cancel(); console.log(JSON.stringify({status:response.status}));",
          ],
          { capture: true, input: JSON.stringify({ grant: saved.renewalGrant, workbenchId: saved.workbenchId }) },
        ),
      ) as { status: number };
      enroll = localGrantNeedsEnrollment(probe.status);
    }
    if (enroll) {
      const enrolled = JSON.parse(
        await run([...compose, "exec", "-T", "authority", "bun", "/app/enroll-local.js"], {
          capture: true,
          input: JSON.stringify({ environmentId: identity.environmentId, workbenchId: scope.workbenchId }),
        }),
      ) as { token: string };
      await writeFile(
        configPath,
        JSON.stringify(
          {
            connections: upsertLocalRelayConnection(existing.connections, {
              ...scope,
              environmentId: identity.environmentId,
              managerOrigin: "https://authority:8443",
              relayOrigin: "https://relay:8080",
              renewalGrant: enrolled.token,
            }),
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
      await chmod(configPath, 0o600);
    }
    if (enroll || trustChanged) await run(["docker", "restart", `${app}-prompt-studio-1`]);
    const url = `${connection.dashboardUrl}projects/${scope.workbenchId}/extensions/pstdio.pstdio-notes/notes`;
    await writeFile(
      join(directory, `${app}.json`),
      JSON.stringify({ ...connection, environmentId: identity.environmentId, url }),
      { mode: 0o600 },
    );
    console.log(`${app}: ${url}`);
  }
  console.log(`Stop and remove this fixture: bun run dev:relay -- --name=${name} --down`);
}
