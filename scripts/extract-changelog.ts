import { readdir } from "node:fs/promises";
import { join } from "node:path";

export const findPackageDir = async (name: string) => {
  for (const root of ["packages", "extensions"] as const) {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = join(root, entry.name, "package.json");
      const manifestFile = Bun.file(manifestPath);
      if (!(await manifestFile.exists())) continue;
      const manifest = await manifestFile.json();
      if (manifest.name === name) return join(root, entry.name);
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
  const [name, version] = process.argv.slice(2);
  if (!name || !version) {
    console.error("usage: extract-changelog.ts <package-name> <version>");
    process.exit(1);
  }

  const dir = await findPackageDir(name);
  if (!dir) {
    console.error(`package not found: ${name}`);
    process.exit(1);
  }

  const changelog = await Bun.file(join(dir, "CHANGELOG.md")).text();
  const section = extractSection(changelog, version);
  if (section === null) {
    console.error(`no changelog section for ${name}@${version}`);
    process.exit(1);
  }

  process.stdout.write(section.length > 0 ? `${section}\n` : "_No changelog entry._\n");
};

if (import.meta.main) {
  await main();
}
