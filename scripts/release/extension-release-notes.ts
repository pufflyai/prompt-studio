import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { publishedExtensionDirs } from "../verify/verify-published-extensions";

export const independentExtensionNotes = async (root: string, hostVersion: string) => {
  const git = (args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  const tags = git(["tag", "--merged", "HEAD", "--list", "pstdio@*"]);
  const previous =
    tags.status === 0
      ? tags.stdout
          .trim()
          .split("\n")
          .filter((tag) => /^pstdio@\d+\.\d+\.\d+$/.test(tag) && Bun.semver.order(tag.slice(7), hostVersion) < 0)
          .sort((a, b) => Bun.semver.order(b.slice(7), a.slice(7)))[0]
      : undefined;
  const sections: string[] = [];
  for (const dir of await publishedExtensionDirs(root)) {
    const manifest = await Bun.file(join(root, dir, "package.json")).json();
    // Git object paths use "/" on every platform; dir uses the native separator.
    const before = previous ? git(["show", `${previous}:${dir.replaceAll("\\", "/")}/package.json`]) : undefined;
    const oldVersion = before?.status === 0 ? (JSON.parse(before.stdout).version as string) : undefined;
    if (oldVersion === manifest.version) continue;
    const file = Bun.file(join(root, dir, "CHANGELOG.md"));
    if (!(await file.exists())) continue;
    const changelog = await file.text();
    const entries = [...changelog.matchAll(/^## (\d+\.\d+\.\d+)\s*$/gm)];
    const notes = entries.flatMap((entry, index) => {
      const version = entry[1]!;
      if (
        Bun.semver.order(version, manifest.version) > 0 ||
        (oldVersion ? Bun.semver.order(version, oldVersion) <= 0 : version !== manifest.version)
      )
        return [];
      const text = changelog
        .slice(entry.index! + entry[0].length, entries[index + 1]?.index)
        .replace(/^_\d{4}-\d{2}-\d{2}_\s*$/gm, "")
        .trim();
      return text ? [text] : [];
    });
    if (notes.length) sections.push(`## ${manifest.name}\n\n${notes.join("\n\n")}\n\n`);
  }
  return sections;
};
