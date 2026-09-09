import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import type { WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { subscribeToExtensionEventFeed } from "@/shared/extensions/extension-webview-broadcast";
import { surfaceNotificationCommandResponse } from "./notification-center-widget";

describe("NotificationCenterWidget", () => {
  test("surfaces extension command notices from notification actions", () => {
    const shown: unknown[] = [];
    const events: unknown[] = [];
    const unsubscribe = subscribeToExtensionEventFeed((event) => events.push(event));
    const input = {
      workbench: {
        notifications: {
          show: (notification: unknown) => {
            shown.push(notification);
          },
        },
      },
    } as unknown as Pick<WorkbenchPanelRenderInput, "workbench">;
    const response: CommandExecuteResponse = {
      commandId: "extension-lab.say-hello",
      extensionId: "extension-lab",
      eventIds: ["extension-lab.event.changed"],
      outcome: {
        ok: true,
        status: "success",
        notices: [{ type: "info", title: "Lab", message: "Hello from the lab" }],
      },
    };

    try {
      surfaceNotificationCommandResponse(input, response, "notification-project");
      expect(events).toEqual([{ id: "extension-lab.event.changed", projectId: "notification-project" }]);
    } finally {
      unsubscribe();
    }

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
