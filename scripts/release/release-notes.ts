import { dirname, join } from "node:path";

type RootManifest = {
  workspaces?: string[];
};

export const findPackageDir = async (name: string, cwd: string) => {
  const rootManifest = (await Bun.file(join(cwd, "package.json")).json()) as RootManifest;

  for (const workspace of rootManifest.workspaces ?? []) {
    const manifests = new Bun.Glob(`${workspace.replace(/\/$/, "")}/package.json`);
    for await (const manifestPath of manifests.scan({ cwd, dot: true, onlyFiles: true })) {
      const manifestFile = Bun.file(join(cwd, manifestPath));
      const manifest = await manifestFile.json();
      if (manifest.name === name) return dirname(join(cwd, manifestPath));
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

export const createReleaseNotes = async (cwd: string, version: string) => {
  const { read: readChangesetsConfig } = await import("@changesets/config");
  const config = await readChangesetsConfig(cwd);
  const sections: string[] = [];
  for (const name of config.fixed[0] ?? []) {
    const dir = await findPackageDir(name, cwd);
    if (!dir) throw new Error(`package not found: ${name}`);
    const file = Bun.file(join(dir, "CHANGELOG.md"));
    if (!(await file.exists())) continue;
    const section = extractSection(await file.text(), version);
    if (section === null) throw new Error(`no changelog section for ${name}@${version}`);
    const notes = section.replace(/^_\d{4}-\d{2}-\d{2}_\s*$/gm, "").trim();
    if (notes) sections.push(`## ${name}\n\n${notes}\n\n`);
  }
  return sections.length ? sections.join("") : "_No changelog entries._\n";
};

if (import.meta.main) {
  try {
    const [version] = process.argv.slice(2);
    if (!version) throw new Error("usage: release-notes.ts <version>");
    process.stdout.write(await createReleaseNotes(process.cwd(), version));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
