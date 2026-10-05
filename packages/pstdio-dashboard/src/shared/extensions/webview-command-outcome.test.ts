import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { surfaceWebviewCommandOutcome } from "./webview-command-outcome";

describe("webview command reports", () => {
  for (const status of ["error", "rejected"] as const) {
    test(`reports one ${status} outcome beside its notices`, () => {
      const notices: unknown[] = [];
      surfaceWebviewCommandOutcome(
        {
          commandId: "save",
          extensionId: "notes",
          middlewareTrace: [],
          outcome: {
            ok: false,
            status,
            reason: "Cannot save",
            notices: [{ type: "info", message: "Check your folder" }],
          },
        } as CommandExecuteResponse,
        (notice) => notices.push(notice),
      );
      expect(notices).toEqual([
        { type: "info", title: "Extension notice", description: "Check your folder" },
        {
          type: status === "error" ? "error" : "warning",
          title: status === "error" ? "Extension command failed" : "Extension command rejected",
          description: "Cannot save",
        },
      ]);
    });
  }
});
