import { defineCommand, defineExtension, params } from "@pstdio/sdk/extensions";

// Keep access to existing comparison choices while Canvas adopts the same project files.
export default defineExtension({
  commands: [
    defineCommand({
      id: "compare.export",
      title: "Read legacy shader comparison",
      params: { shader: params.text({ required: true }) },
      run: (ctx, input) => ctx.storage.collection("compare").get(input.shader),
    }),
  ],
});
