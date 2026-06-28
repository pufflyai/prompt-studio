import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { surfaceNotificationCommandResponse } from "./notification-center-widget";

describe("NotificationCenterWidget", () => {
  test("surfaces extension command notices from notification actions", () => {
    const shown: unknown[] = [];
    const input = {
      workbench: {
        notifications: {
          show: (notification: unknown) => {
            shown.push(notification);
          },
        },
      },
    } as unknown as Pick<WorkbenchWidgetRenderInput, "workbench">;
    const response: CommandExecuteResponse = {
      commandId: "extension-lab.say-hello",
      extensionId: "extension-lab",
      outcome: {
        ok: true,
        status: "success",
        notices: [{ type: "info", title: "Lab", message: "Hello from the lab" }],
      },
    };

    surfaceNotificationCommandResponse(input, response);

    expect(shown).toEqual([
      {
        level: "info",
        title: "Lab",
        message: "Hello from the lab",
        metadata: { commandId: "extension-lab.say-hello", extensionId: "extension-lab" },
      },
    ]);
  });
});
