import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { unzipSync } from "fflate";
import { version } from "../package.json";
import { validateSidecarArtifact } from "../src/runtime/sidecar-artifact";

if (process.platform !== "win32") throw new Error("Windows signature verification requires Windows");
const desktopRoot = resolve(import.meta.dirname, "..");
const app = join(desktopRoot, "out", "Prompt Studio-win32-x64");
const make = join(desktopRoot, "out", "make");
const installers = [...new Bun.Glob("**/*Setup.exe").scanSync({ cwd: make, absolute: true })];
const packages = [...new Bun.Glob("**/*-full.nupkg").scanSync({ cwd: make, absolute: true })];
if (installers.length !== 1 || packages.length !== 1)
  throw new Error("Expected one Windows installer and full update package");
const extracted = mkdtempSync(join(tmpdir(), "pstdio-signed-payload-"));
try {
  const payloadFiles = ["Prompt Studio.exe", "resources/bin/pstdio.exe", "resources/bin/pstdio.manifest.json"];
  const archive = unzipSync(readFileSync(packages[0]!), {
    filter: (file) => payloadFiles.some((path) => file.name === `lib/net45/${path}`),
  });
  for (const path of payloadFiles) {
    const bytes = archive[`lib/net45/${path}`];
    if (!bytes) throw new Error(`Update package is missing ${path}`);
    const destination = join(extracted, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, bytes);
  }
  const paths = [
    join(app, "Prompt Studio.exe"),
    join(app, "resources", "bin", "pstdio.exe"),
    ...installers,
    ...payloadFiles.filter((path) => path.endsWith(".exe")).map((path) => join(extracted, path)),
  ];
  const verification = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `
    $ErrorActionPreference = 'Stop'
    $results = foreach ($path in ($env:PSTDIO_VERIFY_SIGNATURE_PATHS | ConvertFrom-Json)) {
      $signature = Get-AuthenticodeSignature -LiteralPath $path
      if ($signature.Status -ne 'Valid') { throw "Invalid signature: $path ($($signature.Status))" }
      if (-not $signature.TimeStamperCertificate) { throw "Missing timestamp: $path" }
      @{ path = $path; subject = $signature.SignerCertificate.Subject; status = $signature.Status.ToString(); timestampSubject = $signature.TimeStamperCertificate.Subject }
    }
    $results | ConvertTo-Json
  `,
    ],
    { encoding: "utf8", env: { ...process.env, PSTDIO_VERIFY_SIGNATURE_PATHS: JSON.stringify(paths) } },
  );
  if (verification.error) throw verification.error;
  if (verification.status !== 0) throw new Error(verification.stderr || verification.stdout);
  for (const root of [app, extracted]) {
    await validateSidecarArtifact({
      resourcesPath: join(root, "resources"),
      platform: "win32",
      arch: "x64",
      appVersion: version,
    });
  }
  const evidence = join(desktopRoot, "test-results", "windows-signatures.json");
  mkdirSync(dirname(evidence), { recursive: true });
  writeFileSync(evidence, `${JSON.stringify(JSON.parse(verification.stdout), null, 2)}\n`);
  process.stdout.write(
    "Windows app, runtime, installer, and update payload signatures and timestamps are valid. Runtime checksums match.\n",
  );
} finally {
  rmSync(extracted, { recursive: true, force: true });
}
