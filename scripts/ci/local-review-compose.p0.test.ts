import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupReviewCompose } from "./local-review-compose";
import { runCiChecks } from "./run-ci-checks";

for (const { exitCode, malformed } of [
  { exitCode: 0, malformed: false },
  { exitCode: 1, malformed: false },
  { exitCode: 0, malformed: true },
])
  test(`owned Compose cleanup preserves exact targets and reports exit ${exitCode}, malformed=${malformed}`, async () => {
    if (process.platform === "win32") return;
    const root = mkdtempSync(join(tmpdir(), "review-compose-"));
    const previousPath = process.env.PATH;
    try {
      const bin = join(root, "bin");
      mkdirSync(bin);
      const calls = join(root, "calls.jsonl");
      const executable = join(bin, "docker");
      writeFileSync(
        executable,
        `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';appendFileSync(${JSON.stringify(calls)},JSON.stringify(process.argv.slice(2))+'\\n');process.exit(${exitCode});\n`,
      );
      chmodSync(executable, 0o755);
      process.env.PATH = `${bin}:${previousPath}`;
      const entries = [
        { project: "owned-a", file: join(root, "a with spaces.json") },
        { project: "owned-b", file: join(root, "b.json") },
      ];
      writeFileSync(
        join(root, "compose-projects.jsonl"),
        [
          ...entries.map((entry) => JSON.stringify(entry)),
          JSON.stringify(entries[0]),
          ...(malformed ? ["{broken"] : []),
        ].join("\n"),
      );
      const results = await cleanupReviewCompose(root);
      expect(results.map((entry) => entry.outcome)).toEqual([
        ...(malformed ? (["failure"] as const) : []),
        exitCode ? "failure" : "success",
        exitCode ? "failure" : "success",
      ]);
      expect(
        readFileSync(calls, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line)),
      ).toEqual(
        entries.map(({ project, file }) => [
          "compose",
          "-f",
          file,
          "-p",
          project,
          "down",
          "--volumes",
          "--remove-orphans",
        ]),
      );
    } finally {
      process.env.PATH = previousPath;
      rmSync(root, { recursive: true, force: true });
    }
  });

test("a run without Compose projects needs no Docker daemon", async () => {
  const root = mkdtempSync(join(tmpdir(), "review-no-compose-"));
  try {
    expect(await cleanupReviewCompose(root)).toEqual([]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("integration launchers retain exact cleanup registrations before Compose startup", async () => {
  if (process.platform === "win32") return;
  const root = mkdtempSync(join(tmpdir(), "review-compose-launchers-"));
  const repo = join(import.meta.dir, "../..");
  const manifest = join(root, "compose-projects.jsonl");
  const retained: string[] = [];
  try {
    const executable = join(root, "docker");
    // A CLI fixture checks the launcher/cleanup protocol without a Docker daemon.
    writeFileSync(
      executable,
      `#!${process.execPath}\nimport {readFileSync} from 'node:fs';const args=process.argv.slice(2);if(args[0]==='inspect'){console.log('0');process.exit(0)}const project=args[args.indexOf('-p')+1];const entries=readFileSync(process.env.PSTDIO_LOCAL_REVIEW_COMPOSE_MANIFEST,'utf8').trim().split('\\n').map(JSON.parse);if(!entries.some(e=>e.project===project))process.exit(3);\n`,
    );
    chmodSync(executable, 0o755);
    for (const owner of ["services/account-manager", "services/relay", "packages/pstdio-sync-contracts"]) {
      const script = owner.endsWith("pstdio-sync-contracts") ? "scripts/isolated.ts" : "scripts/test-isolated.ts";
      const child = Bun.spawn([process.execPath, script], {
        cwd: join(repo, owner),
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH}`,
          TEST_PRIORITIES: "P1",
          PSTDIO_LOCAL_REVIEW_COMPOSE_MANIFEST: manifest,
          MANAGER_TEST_SUBNET: undefined,
          SYNC_TEST_SUBNET: undefined,
        },
      });
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect({ exitCode, stdout, stderr }).toMatchObject({ exitCode: 0 });
    }
    const entries = readFileSync(manifest, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(entries).toHaveLength(3);
    expect(new Set(entries.map((entry) => entry.project)).size).toBe(3);
    for (const entry of entries) {
      expect(readFileSync(entry.file, "utf8").length).toBeGreaterThan(0);
      if (!entry.file.endsWith("compose.json")) continue;
      retained.push(entry.file);
      const config = JSON.parse(readFileSync(entry.file, "utf8"));
      expect(config.networks.default.ipam).toBeUndefined();
    }
  } finally {
    for (const file of retained) rmSync(join(file, ".."), { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("raw container cleanup removes only registered containers that still exist", async () => {
  if (process.platform === "win32") return;
  const root = mkdtempSync(join(tmpdir(), "review-container-"));
  const previousPath = process.env.PATH;
  try {
    const calls = join(root, "calls.jsonl");
    const executable = join(root, "docker");
    writeFileSync(
      executable,
      `#!${process.execPath}\nimport {appendFileSync} from 'node:fs';const args=process.argv.slice(2);appendFileSync(${JSON.stringify(calls)},JSON.stringify(args)+'\\n');if(args[0]==='container' && args.at(-1)==='name=^/owned\\\\.alive$')console.log('abc123');\n`,
    );
    chmodSync(executable, 0o755);
    process.env.PATH = `${root}:${previousPath}`;
    writeFileSync(
      join(root, "compose-projects.jsonl"),
      [{ container: "owned.alive" }, { container: "owned-removed" }].map((entry) => JSON.stringify(entry)).join("\n"),
    );
    expect((await cleanupReviewCompose(root)).map((entry) => entry.outcome)).toEqual(["success", "success"]);
    const commands = readFileSync(calls, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(commands.filter((args) => args[0] === "rm")).toEqual([["rm", "--force", "abc123"]]);
  } finally {
    process.env.PATH = previousPath;
    rmSync(root, { recursive: true, force: true });
  }
});

test("supervisor can clean a registered Compose project after its launcher is killed", async () => {
  if (process.platform === "win32") return;
  const root = mkdtempSync(join(tmpdir(), "review-interrupted-compose-"));
  const previousPath = process.env.PATH;
  const controller = new AbortController();
  const marker = join(root, "started");
  const manifest = join(root, "compose-projects.jsonl");
  const timer = setInterval(() => {
    if (existsSync(marker)) controller.abort();
  }, 10);
  let retained: string | undefined;
  try {
    const executable = join(root, "docker");
    writeFileSync(
      executable,
      `#!${process.execPath}\nimport {writeFileSync} from 'node:fs';if(process.argv.includes('up')){writeFileSync(${JSON.stringify(marker)},'started');setInterval(()=>{},1000)}else if(process.argv.includes('down'))writeFileSync(${JSON.stringify(join(root, "cleaned"))},'cleaned');\n`,
    );
    chmodSync(executable, 0o755);
    process.env.PATH = `${root}:${previousPath}`;
    const result = await runCiChecks(
      [
        {
          id: "manager",
          command: [process.execPath, "scripts/test-isolated.ts"],
          cwd: join(import.meta.dir, "../../services/account-manager"),
        },
      ],
      {
        priority: "P0",
        signal: controller.signal,
        cleanupOnExit: true,
        env: { TEST_PRIORITIES: "P1", PSTDIO_LOCAL_REVIEW_COMPOSE_MANIFEST: manifest },
      },
    );
    expect(result.outcome).toBe("failure");
    const entry = JSON.parse(readFileSync(manifest, "utf8").trim());
    retained = entry.file;
    expect(existsSync(entry.file)).toBe(true);
    expect((await cleanupReviewCompose(root)).map((entry) => entry.outcome)).toEqual(["success"]);
    expect(existsSync(join(root, "cleaned"))).toBe(true);
  } finally {
    clearInterval(timer);
    process.env.PATH = previousPath;
    if (retained) rmSync(join(retained, ".."), { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});
