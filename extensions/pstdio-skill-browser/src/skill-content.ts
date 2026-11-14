import type { ExtensionContextBase, NavigationTarget, TreeNode } from "@pstdio/sdk/extensions";
import type { Skill } from "@pstdio/sdk/resources";
import { parseSkillMetadata } from "./parse-skill-metadata";

export const readSkill = async (ctx: ExtensionContextBase, name?: string) => {
  const skills = (await ctx.skills?.list()) ?? [];
  if (!name) return skills[0] ?? null;
  const skill = skills.find((skill) => skill.name === name);
  if (!skill) throw new Error(`Skill not found: ${name}`);
  return skill;
};

export const selectedSkillFile = (skill: Skill, path: unknown) =>
  skill.files.find((file) => file.path === (path ?? "SKILL.md")) ?? skill.files[0];

export const skillFiles = (
  skill: Skill,
  selectedPath: string | undefined,
  target: (path: string) => NavigationTarget,
) => {
  const roots: TreeNode[] = [];
  const directories = new Map<string, TreeNode>();
  for (const file of skill.files) {
    const segments = file.path.split("/");
    let nodes = roots;
    let path = "";
    for (const segment of segments.slice(0, -1)) {
      path = path ? `${path}/${segment}` : segment;
      let directory = directories.get(path);
      if (!directory) {
        directory = { id: `dir:${path}`, label: segment, icon: "folder", children: [] };
        directories.set(path, directory);
        nodes.push(directory);
      }
      nodes = directory.children!;
    }
    nodes.push({
      id: file.path,
      label: segments.at(-1)!,
      fileName: file.path,
      selected: file.path === selectedPath,
      target: target(file.path),
    });
  }
  return roots;
};

export const skillInfo = (skill: Skill) => {
  const metadata = parseSkillMetadata(skill.files.find((file) => file.path === "SKILL.md")?.content ?? "");
  const description = metadata.description || skill.description;
  const nodes: TreeNode[] = [{ id: "name", label: metadata.name || skill.name, icon: "sparkles" }];
  if (metadata.version) nodes.push({ id: "version", label: `Version ${metadata.version}`, icon: "tag" });
  if (description) nodes.push({ id: "description", label: description, tooltip: description });
  return { id: "info", label: "Info", nodes };
};
