import { describe, expect, test } from "bun:test";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { loadFontEditor } from "./font-editor-api";

describe("font editor webview API", () => {
  test("loads the editor through its registered extension commands", async () => {
    const commandIds: string[] = [];
    const host = {
      extensionId: "pstdio.font-editor",
      call: async (_method: string, params: { commandId: string }) => {
        commandIds.push(params.commandId);
        return { outcome: { status: "success", value: {} } };
      },
    } as GuestHost;

    await loadFontEditor(host);

    expect(commandIds).toEqual([
      "pstdio.font-editor.command.inspect",
      "pstdio.font-editor.command.preview",
      "pstdio.font-editor.command.config.get",
    ]);
  });
});
