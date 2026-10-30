import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const root = resolve(import.meta.dir, "../../../../..");

/** An owned PS-786 Compose deployment, with public ingress replaced by loopback ports. */
export const deploy = async (image: string, log: (message: string) => void, signal: AbortSignal) => {
  const project = `ps787-${crypto.randomUUID()}`;
  const directory = await mkdtemp(join(tmpdir(), `${project}-`));
  const { publicKey, privateKey } = await generateKeyPair("EdDSA");
  const trust = {
    issuer: "https://ps787.invalid/accounts",
    audience: "https://ps787.invalid/relay",
    jwks: { keys: [{ ...(await exportJWK(publicKey)), kid: project, alg: "EdDSA" }] },
  };
  const env = {
    ...process.env,
    COMPOSE_PROGRESS: "quiet",
    RELAY_IMAGE: image,
    MANAGER_IMAGE: "unused:measurement",
    RELAY_DOMAIN: "ps787.invalid",
    MANAGER_DOMAIN: "ps787.invalid",
    RELAY_DB_PASSWORD: "ps787-disposable-only",
    MANAGER_DB_PASSWORD: "unused",
    S3_ACCESS_KEY_ID: "ps787-disposable-access",
    S3_SECRET_ACCESS_KEY: "ps787-disposable-secret",
    BETTER_AUTH_SECRET: "unused-measurement-configuration-only",
    GOOGLE_CLIENT_ID: "unused",
    GOOGLE_CLIENT_SECRET: "unused",
    RELAY_ACCESS_TRUST: JSON.stringify(trust),
    RELAY_RECOVERY_KEY: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64"),
  };
  const run = async (args: string[], cleanup = false) => {
    if (!cleanup) signal.throwIfAborted();
    const child = Bun.spawn(args, { cwd: root, env, stdout: "pipe", stderr: "pipe" });
    const stop = () => child.kill("SIGINT");
    if (!cleanup) signal.addEventListener("abort", stop, { once: true });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    signal.removeEventListener("abort", stop);
    // All configuration values in this owned deployment are disposable fixture values.
    if (code !== 0) throw new Error(`Deployment command failed: ${args.slice(0, 3).join(" ")}\n${stderr.slice(-8000)}`);
    if (stderr.trim()) log(stderr.trim().split("\n").slice(-12).join("\n"));
    return stdout.trim();
  };
  const config = JSON.parse(
    await run([
      "docker",
      "compose",
      "--profile",
      "setup",
      "-f",
      "infra/relay/compose.yaml",
      "config",
      "--format",
      "json",
    ]),
  );
  for (const name of ["manager", "manager-migrate", "manager-db", "ingress"]) delete config.services[name];
  for (const name of ["manager-db", "ingress-data", "ingress-config"]) delete config.volumes[name];
  for (const value of Object.values(config.volumes)) delete (value as { name?: string }).name;
  for (const value of Object.values(config.networks)) delete (value as { name?: string }).name;
  for (const [name, target] of [
    ["relay", 8080],
    ["relay-db", 5432],
    ["objects", 9000],
  ] as const) {
    config.services[name].ports = [{ target, published: "0", host_ip: "127.0.0.1" }];
    config.services[name].networks = { edge: {}, relay: {} };
  }
  await Bun.write(join(directory, "compose.json"), JSON.stringify(config));
  const compose = ["docker", "compose", "-p", project, "-f", join(directory, "compose.json")];
  const close = async () => {
    await run([...compose, "--profile", "setup", "down", "--volumes", "--remove-orphans"], true);
    await rm(directory, { recursive: true, force: true });
  };
  const port = async (service: string, target: number) =>
    (await run([...compose, "port", service, String(target)])).split(":").at(-1)!;
  try {
    log(`Starting owned Compose deployment ${project}`);
    await run([...compose, "up", "-d", "--wait", "relay-db", "objects"]);
    await run([...compose, "run", "--rm", "bucket"]);
    await run([...compose, "up", "-d", "--wait", "relay"]);
    const operator = await Bun.build({
      entrypoints: [join(root, "services/relay/src/runtime.ts")],
      target: "bun",
      outdir: directory,
    });
    if (!operator.success) throw new Error("Could not bundle the owned cleanup operator");
    await run([...compose, "cp", join(directory, "runtime.js"), "relay:/app/runtime-measurement.js"]);
    const origin = `http://127.0.0.1:${await port("relay", 8080)}`;
    const endpoint = `http://127.0.0.1:${await port("objects", 9000)}`;
    const databaseUrl = `postgres://relay:ps787-disposable-only@127.0.0.1:${await port("relay-db", 5432)}/relay`;
    return {
      project,
      signal,
      operatorHash: new Bun.CryptoHasher("sha256")
        .update(await Bun.file(join(directory, "runtime.js")).arrayBuffer())
        .digest("hex"),
      origin,
      endpoint,
      databaseUrl,
      close,
      s3: {
        endpoint,
        region: "us-east-1",
        forcePathStyle: true,
        credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
      },
      metadata: async () => {
        const [details] = JSON.parse(await run(["docker", "image", "inspect", image]));
        return {
          id: details.Id,
          tag: image,
          ociLabels: {
            source: details.Config.Labels?.["org.opencontainers.image.source"] ?? null,
            revision: details.Config.Labels?.["org.opencontainers.image.revision"] ?? null,
          },
        };
      },
      token: async (accountId: string, workbenchId: string, environmentId: string) =>
        new SignJWT({ tokenType: "pstdio-environment-access", accountId, workbenchId, environmentId })
          .setProtectedHeader({ alg: "EdDSA", kid: project })
          .setIssuer(trust.issuer)
          .setAudience(trust.audience)
          .setSubject(environmentId)
          .setIssuedAt()
          .setExpirationTime("2h")
          .sign(privateKey),
      cleanup: async () => {
        // Run the same cleanup implementation as the service, only against this deployment's DB/bucket.
        await run([
          ...compose,
          "exec",
          "-T",
          "relay",
          "bun",
          "-e",
          "const {createRelayRuntime}=await import('./runtime-measurement.js'); const r=createRelayRuntime(process.env); try {await r.sync.cleanup()} finally {await r.close()}",
        ]);
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
};
