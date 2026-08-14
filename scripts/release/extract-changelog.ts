import { dirname, join } from "node:path";

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

  const changelogFile = Bun.file(join(dir, "CHANGELOG.md"));
  if (!(await changelogFile.exists())) {
    process.stdout.write("_No changelog entry._\n");
    return;
  }

  const changelog = await changelogFile.text();
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
