import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { assertActorReservation, assertPairReservations, kube, provision } from "./cloud-team/infra";
import { createActorLauncher } from "./cloud-team/launch";
import { recoverProvisioning } from "./cloud-team/operator";
import { command, setExecutionSignal, until } from "./cloud-team/process";
import { evidence, setup, verify } from "./cloud-team/scenario";
import type { Pair } from "./cloud-team/types";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    source: { type: "string", default: process.cwd() },
    directory: { type: "string" },
    kubectl: { type: "string", default: "kubectl" },
    namespace: { type: "string", default: "pocketcoder" },
    minutes: { type: "string", default: "60" },
    keep: { type: "boolean", default: false },
    help: { type: "boolean" },
  },
});
const mode = positionals[0] ?? "run";
if (values.help || !["run", "up", "test", "down"].includes(mode)) {
  console.log(`bun scripts/dev/cloud-team.ts [run|up|test|down] [options]
  run: launch, sign in, verify, clean up (use --keep to retain for inspection)
  up:  launch, sign in, create a team/project, install required extension, verify two-way sync; retain
  test --directory PATH: check restrictions, release policy, remove member and verify cutover (destructive)
  down --directory PATH: stop only this run's two Cloud Workspaces and disposable backend
  --kubectl PATH   configured operator kubectl executable or wrapper
  --namespace NAME (default pocketcoder)   --source PATH   --minutes 60
  --directory PATH private local evidence/state folder (required for test/down)

The OAuth provider is simulated; the manager, relay, PostgreSQL, object store and both app runtimes are real.
No CI wiring. No Microsoft passwords, MFA bypass, copied device logins or production auth changes.`);
  process.exit(values.help ? 0 : 1);
}
const minutes = Number(values.minutes);
if (!Number.isInteger(minutes) || minutes < 10 || minutes > 120) throw new Error("--minutes must be 10..120");
let pair: Pair;
if (mode === "test" || mode === "down") {
  if (!values.directory) throw new Error("--directory is required");
  pair = JSON.parse(await readFile(resolve(values.directory, "state.json"), "utf8"));
} else {
  const id = crypto.randomUUID();
  const source = resolve(values.source!);
  pair = {
    id,
    source,
    sourceCommit: (await command(["git", "-C", source, "rev-parse", "HEAD"])).trim(),
    sourceDirty: Boolean((await command(["git", "-C", source, "status", "--porcelain"])).trim()),
    directory: resolve(values.directory ?? `${source}/__test-tmp__/cloud-team/${id}`),
    kubectl: values.kubectl!,
    namespace: values.namespace!,
    name: `ct-${id.slice(0, 12)}`,
    deadline: new Date(Date.now() + minutes * 60_000).toISOString(),
  };
  const insideSource = relative(pair.source, pair.directory);
  if (!insideSource.startsWith("../") && insideSource !== "..") {
    await command(["git", "-C", pair.source, "check-ignore", "--quiet", `${pair.directory}/state.json`]).catch(() => {
      throw new Error("Evidence inside the source checkout must be Git-ignored; use a private external --directory");
    });
  }
  await mkdir(dirname(pair.directory), { recursive: true });
  await mkdir(pair.directory, { mode: 0o700 });
  await chmod(pair.directory, 0o700);
}
let saving = Promise.resolve();
const save = () => {
  saving = saving.then(async () => {
    const temporary = `${pair.directory}/state.pending.json`;
    await writeFile(temporary, JSON.stringify(pair, null, 2), { mode: 0o600 });
    await rename(temporary, `${pair.directory}/state.json`);
  });
  return saving;
};
await save();
console.log(`Cloud team run: ${pair.id}\nPrivate state: ${pair.directory}`);
const down = async () => {
  setExecutionSignal();
  try {
    await recoverProvisioning(pair, save);
  } catch (error) {
    await evidence(pair, "cleanup", { passed: false, errors: [String(error)] });
    throw error;
  }
  await Promise.all([pair.owner, pair.member].filter((actor) => actor !== undefined).map(assertActorReservation));
  const results = await Promise.allSettled(
    [pair.owner, pair.member]
      .filter((actor) => actor !== undefined)
      .map(async (actor) => {
        if (!actor.runId) throw new Error(`No holding run for ${actor.workspaceId}; refusing unguarded stop`);
        await command(["pst", "pocketcoder.remote-testing", "runs", "cancel", "--run-id", actor.runId]);
        // stopAfterRun=true collection stops the environment while retaining the run's exact claim.
        // Do not release then call environments.stop: an explicit reuse could claim it between those steps.
        return command(
          ["pst", "pocketcoder.remote-testing", "runs", "show", "--run-id", actor.runId],
          undefined,
          false,
          120_000,
        );
      }),
  );
  const actorErrors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  if (actorErrors.length) {
    await evidence(pair, "cleanup", { passed: false, errors: actorErrors.map(String) });
    throw new AggregateError(
      actorErrors,
      "Workspace cleanup is uncertain; backend retained until ownership is resolved",
    );
  }
  try {
    await until(
      "owned Cloud workspace pods removed",
      async () => {
        const pods = JSON.parse(await kube(pair, ["get", "pods", "-o", "json"])).items;
        return !pods.some((pod: { metadata: { labels?: Record<string, string> } }) =>
          [pair.owner?.workspaceId, pair.member?.workspaceId]
            .filter(Boolean)
            .includes(pod.metadata.labels?.["pocketcoder.workspace"]),
        );
      },
      90,
    );
  } catch (error) {
    await evidence(pair, "cleanup", { passed: false, errors: [String(error)] });
    throw new Error("Owned workspace pods remain; backend retained", { cause: error });
  }
  results.push(
    ...(await Promise.allSettled([
      kube(pair, [
        "delete",
        "job,service,secret,networkpolicy",
        "-l",
        `pstdio.cloud-team-run=${pair.id}`,
        "--ignore-not-found=true",
        "--wait=true",
      ]),
    ])),
  );
  const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
  await evidence(pair, "cleanup", { passed: errors.length === 0, errors: errors.map(String) });
  if (errors.length) throw new AggregateError(errors, "Cleanup incomplete; repeat down using the saved state");
};
const cancellation = new AbortController();
setExecutionSignal(cancellation.signal);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    cancellation.abort(new Error("Operator interrupted the Cloud team run"));
  });
let success = false;
try {
  if (mode === "down") {
    await down();
    success = true;
  } else {
    if (mode !== "test") {
      if (pair.sourceDirty) throw new Error("Commit source changes before launching an immutable Cloud pair");
      await command([
        "git",
        "-C",
        pair.source,
        "archive",
        "--format=tar.gz",
        "-o",
        `${pair.directory}/source.tar.gz`,
        pair.sourceCommit,
      ]);
      pair.sourceArchiveSha256 = createHash("sha256")
        .update(await readFile(`${pair.directory}/source.tar.gz`))
        .digest("hex");
      await save();
      const status = JSON.parse(await command(["pst", "pocketcoder.remote-testing", "status"]));
      if (!status.available)
        throw new Error("Configure Cloud Workspaces / Remote Testing on the operator device first");
      const secret = () => randomBytes(32).toString("hex");
      const credentials = { database: secret(), access: secret(), secret: secret() };
      await evidence(pair, "starting disposable PostgreSQL and object storage");
      await provision(pair, credentials);
      const certificate = `${pair.directory}/ca.pem`;
      const key = `${pair.directory}/key.pem`;
      const apps = `${pair.name}-apps.${pair.namespace}.svc.cluster.local`;
      await command([
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        certificate,
        "-days",
        "1",
        "-subj",
        `/CN=${apps}`,
        "-addext",
        `subjectAltName=DNS:${apps}`,
      ]);
      await chmod(key, 0o600);
      const backend = {
        managerOrigin: `https://${apps}:8443`,
        relayOrigin: `https://${apps}:8444`,
        databaseUrl: `postgres://team_test:${credentials.database}@${pair.name}.${pair.namespace}.svc.cluster.local:5432/team_test`,
        objectEndpoint: `http://${pair.name}.${pair.namespace}.svc.cluster.local:9000`,
        objectKey: credentials.access,
        objectSecret: credentials.secret,
        controlToken: secret(),
        cert: await readFile(certificate, "utf8"),
        deadline: pair.deadline,
      };
      const launch = createActorLauncher(
        pair,
        { ...backend, role: "owner", key: await readFile(key, "utf8") },
        minutes,
        save,
      );
      await launch("owner");
      await launch("member");
      await assertPairReservations(pair);
      await setup(pair, save);
    }
    if (mode !== "up") {
      await assertPairReservations(pair);
      await verify(pair);
    }
    await assertPairReservations(pair);
    success = true;
    await evidence(
      pair,
      mode === "up" ? "setup passed; both signed-in workspaces retained" : "two-workspace scenario passed",
    );
  }
} catch (error) {
  await evidence(pair, "failed", { error: String(error) });
  throw error;
} finally {
  if ((mode === "run" && !values.keep) || (!success && mode === "up" && !values.keep)) await down();
  await save();
}
