import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repository = resolve(import.meta.dirname, "../../../..");
export const startRegistryService = async () => {
  const root = await mkdtemp(join(tmpdir(), "packaged-psx-"));
  const file = join(root, "compose.json");
  const project = `psx-smoke-${crypto.randomUUID().slice(0, 8)}`;
  const run = async (args: string[]) => {
    const child = spawn(args[0]!, args.slice(1), { cwd: repository, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    const status = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    if (status !== 0) throw new Error(`${args.slice(0, 3).join(" ")} failed: ${stderr}\n${stdout}`);
    return stdout.trim();
  };
  const compose = (...args: string[]) => run(["docker", "compose", "-f", file, "-p", project, ...args]);
  const environment = {
    DATABASE_URL: "postgres://test:isolated-test-only@database:5432/psx",
    S3_ENDPOINT: "http://objects:9000",
    S3_REGION: "us-east-1",
    S3_BUCKET: "psx-packages",
    S3_ACCESS_KEY_ID: "psx-test-access",
    S3_SECRET_ACCESS_KEY: "psx-test-secret-only",
    PSX_PUBLISH_TOKEN: "psx-test-publisher",
    NO_PROXY: "database,objects,localhost,127.0.0.1",
  };
  const image = process.env.PSTDIO_PSX_TEST_IMAGE ?? "pstdio-psx-smoke";
  await writeFile(
    file,
    JSON.stringify({
      services: {
        database: {
          image: "postgres:16-alpine",
          environment: { POSTGRES_DB: "psx", POSTGRES_USER: "test", POSTGRES_PASSWORD: "isolated-test-only" },
          ports: ["127.0.0.1::5432"],
          healthcheck: { test: ["CMD", "pg_isready", "-U", "test", "-d", "psx"], interval: "1s" },
        },
        objects: {
          image: "rustfs/rustfs:1.0.1",
          command: ["/data"],
          ports: ["127.0.0.1::9000"],
          environment: {
            RUSTFS_ACCESS_KEY: environment.S3_ACCESS_KEY_ID,
            RUSTFS_SECRET_KEY: environment.S3_SECRET_ACCESS_KEY,
          },
        },
        registry: {
          image,
          environment,
          ports: ["127.0.0.1::8080"],
          healthcheck: {
            test: ["CMD", "bun", "-e", 'if(!(await fetch("http://127.0.0.1:8080/health")).ok)process.exit(1)'],
            interval: "1s",
          },
        },
      },
      networks: {
        default: { ipam: { config: [{ subnet: process.env.PSTDIO_PSX_TEST_SUBNET ?? "10.254.226.0/24" }] } },
      },
    }),
  );
  const close = async () => {
    try {
      await compose("down", "--volumes", "--remove-orphans");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  };
  try {
    if (!process.env.PSTDIO_PSX_TEST_IMAGE)
      await run(["docker", "build", "-f", "infra/psx/Dockerfile", "-t", image, "."]);
    await compose("up", "-d", "--wait", "database", "objects");
    await compose(
      "run",
      "--rm",
      "registry",
      "bun",
      "-e",
      'const {createPackageObjects}=await import("./dist/index.js");const e=process.env;const o=await createPackageObjects({endpoint:e.S3_ENDPOINT,region:e.S3_REGION,bucket:e.S3_BUCKET,accessKeyId:e.S3_ACCESS_KEY_ID,secretAccessKey:e.S3_SECRET_ACCESS_KEY},true);o.close();',
    );
    await compose(
      "run",
      "--rm",
      "registry",
      "bun",
      "container-entrypoint.ts",
      "bun",
      "dist/database-migration.js",
      "./dist/index.js",
      "migratePsx",
      "test",
    );
    await compose("up", "-d", "--wait", "registry");
    const origin = `http://${await compose("port", "registry", "8080")}`;
    return {
      origin,
      close,
      publish: async (path: string) => {
        const response = await fetch(`${origin}/api/-/publish`, {
          method: "POST",
          headers: { authorization: `Bearer ${environment.PSX_PUBLISH_TOKEN}` },
          body: new Uint8Array(await readFile(path)),
        });
        if (!response.ok) throw new Error(`PSX publication failed: ${response.status} ${await response.text()}`);
      },
    };
  } catch (error) {
    console.error(await compose("logs", "--no-color", "--tail", "80").catch(() => "PSX fixture logs unavailable"));
    await close();
    throw error;
  }
};
