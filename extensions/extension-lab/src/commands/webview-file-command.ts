import { defineCommand, params } from "@pstdio/sdk/extensions";

export const readWebviewFileCommand = defineCommand({
  id: "webview-file.read",
  title: "Read a webview file",
  params: { id: params.text({ required: true }) },
  async run(ctx, commandParams) {
    return { text: new TextDecoder().decode(await ctx.storage.files.getBytes(commandParams.id)) };
  },
});
