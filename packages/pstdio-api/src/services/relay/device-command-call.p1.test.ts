import { expect, spyOn, test } from "bun:test";
import { apiLogger } from "../../lib/logger";
import { createTestApp } from "../../test-utils/create-test-app";
import { withDeviceCommandAttachments } from "./device-command-attachments";
import { createDeviceCommandCaller } from "./device-command-call";

test("a missing local attachment keeps its actionable message instead of suggesting the device is offline", async () => {
  const app = await createTestApp();
  const warning = spyOn(apiLogger, "warn").mockImplementation(() => {});
  try {
    const project = await app.deps.projectService.create({ name: "Missing local attachment" });
    let sent = false;
    const call = createDeviceCommandCaller(() => ({
      call: (_deviceId, command) =>
        withDeviceCommandAttachments(app.deps, project.id, command, async () => {
          sent = true;
          return null;
        }),
    }));
    await expect(
      call(
        project.id,
        "other-device",
        {
          type: "session.create",
          input: { title: "Attached conversation", projectId: project.id, attachments: [{ fileId: "missing" }] },
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("Session attachment not found on this device");
    expect(sent).toBe(false);
    expect(warning).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "relay.device_command.failed",
        workbenchId: project.id,
        err: expect.any(Error),
      }),
      "Device action failed",
    );
  } finally {
    warning.mockRestore();
    await app.close();
  }
});

test("an unexpected device failure logs its cause and exposes the connection guidance", async () => {
  const cause = new Error("Connection closed");
  const warning = spyOn(apiLogger, "warn").mockImplementation(() => {});
  try {
    const call = createDeviceCommandCaller(() => ({ call: async () => Promise.reject(cause) }));
    await expect(
      call("project", "other-device", { type: "session.interrupt", id: "session" }, new AbortController().signal),
    ).rejects.toThrow("Check that the device is online and signed in.");
    expect(warning).toHaveBeenCalledWith(
      { event: "relay.device_command.failed", workbenchId: "project", deviceId: "other-device", err: cause },
      "Device action failed",
    );
  } finally {
    warning.mockRestore();
  }
});
