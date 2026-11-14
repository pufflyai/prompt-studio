import { defineExtension, defineSkill, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  skills: [
    defineSkill({
      id: "create-pstdio-extension",
      title: "Create a pstdio extension",
      source: packageAsset("./skills/create-pstdio-extension", import.meta.url),
    }),
    defineSkill({
      id: "pstdio",
      title: "Use pstdio",
      source: packageAsset("./skills/pstdio", import.meta.url),
    }),
  ],
});
