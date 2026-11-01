import { defineCommand, defineExtension, params } from "@pstdio/sdk/extensions";

// Existing project review records belong to this extension ID. Canvas reads them once through
// this command; the retired extension contributes no views, navigation, player or compiler.
export default defineExtension({
  commands: [
    defineCommand({
      id: "review.export",
      title: "Read legacy motion review",
      params: { study: params.text({ required: true }) },
      run: (ctx, input) => ctx.storage.collection("reviews").get(input.study),
    }),
  ],
});
