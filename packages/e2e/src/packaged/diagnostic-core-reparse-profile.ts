import { lstat, mkdir, readdir, readlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import { runTestCommand } from "../scripts/run-test-command";

const nativeMetadata = `
$ErrorActionPreference = 'Stop'
$paths = ConvertFrom-Json $env:E2E_REPARSE_QUERY_PATHS
foreach ($path in $paths) {
  $item = Get-Item -LiteralPath $path -Force
  [Console]::Error.WriteLine(('Native cache entry ' + (@{
    path = $path
    attributes = $item.Attributes.ToString()
    attributesValue = [int]$item.Attributes
    linkType = $item.LinkType
    target = $item.Target
  } | ConvertTo-Json -Compress)))
  & fsutil.exe reparsepoint query $path
  [Console]::Error.WriteLine(('Native reparse query exit ' + $LASTEXITCODE))
}
exit 0
`;

export const captureCoreReparseMetadata = async (root: string) => {
  const records: { path: string; symbolicLink: boolean; directory: boolean; mode: number; target: string | null }[] =
    [];
  const candidates: string[] = [];
  const started = Date.now();
  const inventory = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const candidate = entry.name === "2.1.0@@@1";
      if (entry.isSymbolicLink() || candidate) {
        const stat = await lstat(path);
        records.push({
          path: relative(root, path),
          symbolicLink: stat.isSymbolicLink(),
          directory: stat.isDirectory(),
          mode: stat.mode,
          target: stat.isSymbolicLink() ? await readlink(path) : null,
        });
        if (candidate) candidates.push(path);
      }
      if (entry.isDirectory() && !entry.isSymbolicLink()) await inventory(path);
    }
  };
  await inventory(root);
  const output = process.env.E2E_CORE_REPARSE_PROFILE_ROOT;
  if (!output) throw new Error("Missing reparse profile output root");
  await mkdir(output, { recursive: true });
  await writeFile(join(output, `${basename(root)}.json`), JSON.stringify({ root, records, candidates }, null, 2));
  console.log(
    "Native cache entry inventory",
    JSON.stringify({ records: records.length, candidates, elapsedMs: Date.now() - started }),
  );
  if (candidates.length) {
    const result = await runTestCommand(
      "pwsh",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", nativeMetadata],
      {
        cwd: tmpdir(),
        env: { ...process.env, E2E_REPARSE_QUERY_PATHS: JSON.stringify(candidates) },
      },
    );
    await writeFile(join(output, `${basename(root)}-native.log`), result.stdout + result.stderr);
    console.log("Native cache entry query", result.stdout);
  }
};
