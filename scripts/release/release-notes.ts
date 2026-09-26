import { dirname, join } from "node:path";
import { read as readChangesetsConfig } from "@changesets/config";

type RootManifest = {
  workspaces?: string[];
};

export const findPackageDir = async (name: string) => {
  const rootManifest = (await Bun.file("package.json").json()) as RootManifest;

  for (const workspace of rootManifest.workspaces ?? []) {
    const manifests = new Bun.Glob(`${workspace.replace(/\/$/, "")}/package.json`);
    for await (const manifestPath of manifests.scan({ dot: true, onlyFiles: true })) {
      const manifestFile = Bun.file(manifestPath);
      const manifest = await manifestFile.json();
      if (manifest.name === name) return dirname(manifestPath);
    }
  }
  return null;
};

export const extractSection = (changelog: string, version: string) => {
  const lines = changelog.replaceAll("\r\n", "\n").split("\n");
  const header = `## ${version}`;
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }

  return lines
    .slice(start + 1, end)
    .join("\n")
    .trim();
};

const main = async () => {
  const [version] = process.argv.slice(2);
  if (!version) throw new Error("usage: release-notes.ts <version>");
  const config = await readChangesetsConfig(process.cwd());
  const sections: string[] = [];
  for (const name of config.fixed[0] ?? []) {
    const dir = await findPackageDir(name);
    if (!dir) throw new Error(`package not found: ${name}`);
    const file = Bun.file(join(dir, "CHANGELOG.md"));
    if (!(await file.exists())) continue;
    const section = extractSection(await file.text(), version);
    if (section === null) throw new Error(`no changelog section for ${name}@${version}`);
    const notes = section.replace(/^_\d{4}-\d{2}-\d{2}_\s*$/gm, "").trim();
    if (notes) sections.push(`## ${name}\n\n${notes}\n\n`);
  }
  process.stdout.write(sections.length ? sections.join("") : "_No changelog entries._\n");
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
