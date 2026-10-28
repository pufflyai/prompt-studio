import { defineExtension, defineHarness, defineHook, packageAsset, workspaceEvents } from "@pstdio/sdk/extensions";
import { createPiHarness } from "./src/harness";

export default defineExtension({
  translations: {
    es: packageAsset("./l10n/es.json", import.meta.url),
    fr: packageAsset("./l10n/fr.json", import.meta.url),
    ja: packageAsset("./l10n/ja.json", import.meta.url),
    ko: packageAsset("./l10n/ko.json", import.meta.url),
    "zh-Hans": packageAsset("./l10n/zh-Hans.json", import.meta.url),
    "zh-Hant": packageAsset("./l10n/zh-Hant.json", import.meta.url),
  },
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
