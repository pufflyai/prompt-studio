import { defineHook, workspaceEvents } from "@pstdio/sdk/extensions";

// Mirror the project skill catalog into the harness agent dir so freshly
// provisioned workspaces always see the current skills before a session starts.
export const provisionSkills = defineHook({
  id: "provisionSkills",
  event: workspaceEvents.provision,
  async run(ctx, _payload) {
    const skills = (await ctx.skills?.list?.()) ?? [];
    const files = skills.flatMap((skill) =>
      skill.files.map((file) => ({ path: `${skill.name}/${file.path}`, content: file.content })),
    );

    if (ctx.workspaceFiles) await ctx.workspaceFiles.syncDir(".agents/skills", files);
  },
});
