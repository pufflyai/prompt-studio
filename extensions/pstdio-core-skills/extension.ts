import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  skills: {
    create_pstdio_extension: {
      title: "Create a pstdio extension",
      source: packageAsset("./skills/create-pstdio-extension", import.meta.url),
    },
    pstdio: {
      title: "Use pstdio",
      source: packageAsset("./skills/pstdio", import.meta.url),
    },
  },
});
