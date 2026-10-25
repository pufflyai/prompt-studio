import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const packagePreviewPlan = (root: string) => {
  const packages = ["sdk", "ui"].map((folder) => {
    const directory = join(root, "packages", folder, ".publish");
    const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
    if (manifest.name !== `@pstdio/${folder}` || !/^\d+\.\d+\.\d+-preview\.sha-[a-f0-9]{40}$/.test(manifest.version))
      throw new Error(`Invalid ${folder} preview artifact`);
    return { name: manifest.name as string, version: manifest.version as string, directory, manifest };
  });
  const [sdk, ui] = packages;
  if (sdk.version !== ui.version || ui.manifest.dependencies?.["@pstdio/sdk"] !== sdk.version)
    throw new Error("UI preview SDK dependency must match the SDK preview exactly");
  if (!sdk.manifest.pstdio?.extensionApiVersion) throw new Error("SDK preview has no extension API metadata");
  return packages;
};

const run = async (command: string[], cwd: string) => {
  const child = Bun.spawn(command, { cwd, stdout: "inherit", stderr: "inherit" });
  if (await child.exited) throw new Error(`${command[1]} failed`);
};

export const previewAlreadyPublished = async (
  name: string,
  version: string,
  registry = "https://registry.npmjs.org",
) => {
  const response = await fetch(`${registry}/${encodeURIComponent(name)}/${version}`);
  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error(`Cannot check ${name}: HTTP ${response.status}`);
};

export const publishPackagePreviews = async (root: string, dryRun = false) => {
  const plan = packagePreviewPlan(root);
  const temporary = mkdtempSync(join(tmpdir(), "pstdio-preview-pack-"));
  try {
    // Pack every artifact before the first publication. A packing failure cannot leave half a pair.
    for (const [index, pkg] of plan.entries())
      await run([process.execPath, "pm", "pack", "--filename", join(temporary, `${index}.tgz`)], pkg.directory);
    if (!dryRun) {
      for (const [index, pkg] of plan.entries()) {
        if (await previewAlreadyPublished(pkg.name, pkg.version)) {
          console.log(`Already published: ${pkg.name}@${pkg.version}`);
          continue;
        }
        // Reuse the trusted npm publisher used by the host workflow; Bun owns install, build and packing.
        await run(
          [
            process.execPath,
            "x",
            "--package",
            "npm@11.16.0",
            "npm",
            "publish",
            join(temporary, `${index}.tgz`),
            "--access",
            "public",
            "--tag",
            "preview",
          ],
          root,
        );
      }
    }
    const published = plan.map(({ name, version }) => ({ name, version }));
    console.log(JSON.stringify({ dryRun, packages: published }));
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `\nSDK/UI preview${dryRun ? " dry run" : ""}\n\n${published.map((pkg) => `- ${pkg.name}@${pkg.version}`).join("\n")}\n\nPin these exact versions in extension dependencies.\n`,
      );
    return published;
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};

if (import.meta.main) await publishPackagePreviews(process.cwd(), process.argv.includes("--dry-run"));
