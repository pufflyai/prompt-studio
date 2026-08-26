import { defineExtension, defineHarness, defineHook, workspaceEvents } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./src/harness";

type ProvisionSkill = {
  name: string;
  source_kind: "project" | "extension";
  files: Array<{ path: string; content: string }>;
};

type OpencodeSkillProvisionContext = {
  skills?: { list(): Promise<ProvisionSkill[]> };
  workspaceFiles?: {
    exists(path: string): Promise<boolean>;
    syncDir(dir: string, files: Array<{ path: string; content: string }>): Promise<void>;
  };
};

export const provisionOpencodeSkills = async (ctx: OpencodeSkillProvisionContext) => {
  if (!ctx.workspaceFiles) return;

  const skills = (await ctx.skills?.list?.()) ?? [];
  const files = skills.flatMap((skill) =>
    skill.files.map((file) => ({ path: `${skill.name}/${file.path}`, content: file.content })),
  );

  await ctx.workspaceFiles.syncDir(".agents/skills", files);

  for (const skill of skills) {
    if (skill.source_kind !== "extension") continue;

    const legacyDir = `.opencode/skills/${skill.name}`;
    if (!(await ctx.workspaceFiles.exists(legacyDir))) continue;

    await ctx.workspaceFiles.syncDir(
      legacyDir,
      skill.files.map((file) => ({ path: file.path, content: file.content })),
    );
  }
};

export default defineExtension({
  harnesses: [defineHarness(createOpencodeHarness())],
  hooks: [
    defineHook({
      id: "provision",
      event: workspaceEvents.provision,
      run: provisionOpencodeSkills,
    }),
  ],
});
