import { defineExtension, defineHarness, defineHook, workspaceEvents } from "@pstdio/sdk/extensions";
import { createPiHarness } from "./src/harness";

export default defineExtension({
  harnesses: [defineHarness(createPiHarness())],
  hooks: [
    defineHook({
      id: "provision",
      event: workspaceEvents.provision,
      async run(ctx) {
        const skills = (await ctx.skills?.list()) ?? [];
        await ctx.workspaceFiles?.syncDir(
          ".pi/skills",
          skills.flatMap((skill) =>
            skill.files.map((file) => ({ path: `${skill.name}/${file.path}`, content: file.content })),
          ),
        );
      },
    }),
  ],
});
