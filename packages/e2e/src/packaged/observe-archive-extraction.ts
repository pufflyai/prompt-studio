import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const root = await mkdtemp(join(tmpdir(), "ps-932-archive-extraction-"));
const results: object[] = [];
const lock = await Bun.file("extensions/pstdio-planner/bun.lock").text();
const packages = [
  ["@ark-ui/react", "5.39.0"],
  ["@chakra-ui/react", "3.37.0"],
  ["es-toolkit", "1.52.0"],
] as const;

async function verifyOutput(directory: string, entries: Map<string, File>) {
  const paths = [...new Bun.Glob("**/*").scanSync({ cwd: directory, onlyFiles: true, dot: true })]
    .map((path) => path.replaceAll("\\", "/"))
    .sort();
  if (JSON.stringify(paths) !== JSON.stringify([...entries.keys()].sort()))
    throw new Error(`Extracted paths differ: ${directory}`);
  let bytes = 0;
  for (const path of paths) {
    const actual = await Bun.file(join(directory, path)).bytes();
    const expected = await entries.get(path)!.bytes();
    if (!Buffer.from(actual).equals(expected)) throw new Error(`Extracted content differs: ${path}`);
    bytes += actual.length;
  }
  return { regularFiles: paths.length, bytes };
}

async function command(argv: string[]) {
  const started = performance.now();
  const child = Bun.spawn(argv, { env: { ...process.env }, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  const usage = child.resourceUsage();
  return {
    argv,
    exitCode,
    elapsedMs: performance.now() - started,
    stdout,
    stderr,
    usage: { cpuTime: usage?.cpuTime, maxRSS: usage?.maxRSS, ops: usage?.ops },
  };
}

try {
  results.push({
    runtime: { bun: Bun.version, revision: Bun.revision, platform: process.platform, arch: process.arch },
    defender: await command([
      "powershell.exe",
      "-NoProfile",
      "-Command",
      "Get-MpComputerStatus | Select-Object AMRunningMode,AntivirusEnabled,RealTimeProtectionEnabled,AMProductVersion | ConvertTo-Json; Get-Command New-MpPerformanceRecording,Get-MpPerformanceReport -ErrorAction SilentlyContinue | Select-Object Name,Source | ConvertTo-Json",
    ]),
  });
  results.push({ tarPath: Bun.which("tar.exe"), tarVersion: await command(["tar.exe", "--version"]) });
  const trace = join(root, "defender.etl");
  process.env.PS932_TRACE = trace;
  let ready = false;
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const recordingReady = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const recorder = Bun.spawn(
    [
      "powershell.exe",
      "-NoProfile",
      "-Command",
      "$ErrorActionPreference='Stop'; New-MpPerformanceRecording -RecordTo $env:PS932_TRACE -Seconds 60",
    ],
    {
      env: { ...process.env, PS932_TRACE: trace },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const recordingOutput = (async () => {
    let stdout = "";
    for await (const chunk of recorder.stdout) {
      stdout += new TextDecoder().decode(chunk);
      console.log(`Defender recorder: ${stdout.slice(-2000)}`);
      if (!ready && /recording(?: has)? started/i.test(stdout)) {
        ready = true;
        resolveReady();
      }
    }
    return stdout;
  })();
  const recording = Promise.all([recorder.exited, recordingOutput, new Response(recorder.stderr).text()]).then(
    ([exitCode, stdout, stderr]) => {
      results.push({ recording: { exitCode, stdout, stderr } });
      if (!ready) rejectReady(new Error(`Recorder exited before readiness: ${exitCode} ${stdout} ${stderr}`));
      return exitCode;
    },
    async (error) => {
      await recorder.exited;
      rejectReady(error instanceof Error ? error : new Error(String(error)));
      results.push({ recordingError: String(error) });
      return 1;
    },
  );
  try {
    await recordingReady;
    for (const [name, version] of packages) {
      const line = lock.split("\n").find((line) => line.includes(`"${name}@${version}"`));
      const expected = line?.match(/"(sha512-[^"]+)"\],?$/)?.[1];
      if (!expected) throw new Error(`Missing frozen integrity for ${name}@${version}`);
      const leaf = name.split("/").at(-1);
      const url = `https://registry.npmjs.org/${name}/-/${leaf}-${version}.tgz`;
      const downloadedAt = performance.now();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const downloadMs = performance.now() - downloadedAt;
      const actual = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
      if (actual !== expected) throw new Error(`Frozen integrity mismatch for ${name}`);
      const packageRoot = join(root, name.replaceAll("/", "-"));
      await mkdir(packageRoot);
      try {
        const inflatedAt = performance.now();
        const tar = gunzipSync(bytes);
        const gunzipMs = performance.now() - inflatedAt;
        const readAt = performance.now();
        const entries = await new Bun.Archive(tar).files();
        const memoryReadMs = performance.now() - readAt;
        const archive = join(packageRoot, "input.tgz");
        await writeFile(archive, bytes);
        const extractedAt = performance.now();
        const extractStartedAt = new Date().toISOString();
        const extractedEntries = await new Bun.Archive(bytes).extract(join(packageRoot, "bun"));
        const bunExtractMs = performance.now() - extractedAt;
        const extractFinishedAt = new Date().toISOString();
        const bunOutput = await verifyOutput(join(packageRoot, "bun"), entries);
        const tarOutput = join(packageRoot, "system-tar");
        await mkdir(tarOutput);
        const systemTar = await command(["tar.exe", "-xzf", archive, "-C", tarOutput]);
        const tarManifest = await verifyOutput(tarOutput, entries);
        const result = {
          name,
          version,
          url,
          integrity: actual,
          compressedBytes: bytes.length,
          tarBytes: tar.length,
          downloadMs,
          gunzipMs,
          memoryReadMs,
          regularFiles: entries.size,
          fileBytes: [...entries.values()].reduce((sum, file) => sum + file.size, 0),
          extractedEntries,
          bunExtractMs,
          extractStartedAt,
          extractFinishedAt,
          bunOutput,
          tarManifest,
          systemTar,
        };
        results.push(result);
        console.log(JSON.stringify(result, (_key, value) => (typeof value === "bigint" ? value.toString() : value)));
        if (systemTar.exitCode !== 0) throw new Error(`System tar failed for ${name}`);
      } finally {
        await rm(packageRoot, { recursive: true, force: true });
      }
    }
  } finally {
    const recordingExit = await recording;
    if (recordingExit !== 0) process.exitCode = 1;
    const report = await command([
      "powershell.exe",
      "-NoProfile",
      "-Command",
      "$ErrorActionPreference='Stop'; Get-MpPerformanceReport -Path $env:PS932_TRACE -TopFiles 30 -TopProcesses 10 -TopScans 30 -Raw | ConvertTo-Json -Depth 20",
    ]);
    await writeFile(join(root, "defender-report.json"), report.stdout);
    results.push({ defenderReport: report });
    if (report.exitCode !== 0) process.exitCode = 1;
  }
} finally {
  await writeFile(
    join(root, "summary.json"),
    JSON.stringify(results, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2),
  );
  console.log(`Diagnostic evidence: ${root}`);
}
