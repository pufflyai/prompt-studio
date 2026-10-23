import { describe, expect, test } from "bun:test";
import type { CommandExecutionResult } from "@pstdio/sdk/api";
import { surfaceWebviewCommandOutcome } from "./webview-command-outcome";

describe("webview command reports", () => {
  for (const status of ["error", "rejected"] as const) {
    test(`forwards notices and leaves a ${status} outcome for the caller to report`, () => {
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
        } as CommandExecutionResult,
        (notice) => notices.push(notice),
      );
      expect(notices).toEqual([{ type: "info", title: "Extension notice", description: "Check your folder" }]);
    });
  }
});
