import { expect, test } from "bun:test";
import { rm, truncate } from "node:fs/promises";
import type { DeviceCommand } from "pstdio-api-contracts";
import { DeviceCommandInputError } from "pstdio-sync/relay";
import { deviceCommandInputLimit } from "pstdio-sync-contracts";
import { uploadSessionAttachment } from "../../features/sessions/session-attachment-upload";
import { createTestApp } from "../../test-utils/create-test-app";
import { DeviceCommandAttachmentError, withDeviceCommandAttachments } from "./device-command-attachments";

test.each([
  "attachments",
  "prompt",
] as const)("rejects excessive encoded %s before reading attachment bytes", async (kind) => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Attachment admission" });
    const attachments = [];
    const paths = new Set<string>();
    for (let index = 0; index < (kind === "attachments" ? 2 : 1); index++) {
      const file = await uploadSessionAttachment(app.deps, project.id, {
        name: `context-${index}.txt`,
        data: Buffer.alloc(kind === "attachments" ? 25 * 1024 * 1024 : 1),
        mimeType: "text/plain",
      });
      attachments.push({ fileId: file.fileId });
      paths.add((await app.deps.fileService.get(file.fileId))!.storage_path);
    }
    // Unreadable blobs make any premature read fail with ENOENT instead of the input-size error.
    for (const path of paths) await rm(path);
    let sent = false;
    const command: DeviceCommand = {
      type: "session.create",
      input: {
        projectId: project.id,
        title: "Large action",
        prompt: kind === "prompt" ? "x".repeat(deviceCommandInputLimit) : "Start",
        attachments,
      },
    };
    await expect(
      withDeviceCommandAttachments(app.deps, project.id, command, async () => {
        sent = true;
        return null;
      }),
    ).rejects.toBeInstanceOf(DeviceCommandInputError);
    expect(sent).toBe(false);
  } finally {
    await app.close();
  }
});

test("admitted attachments keep exact bytes and metadata while duplicate references travel once", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Admitted attachment" });
    const bytes = Buffer.from([0, 1, 2, 255]);
    const file = await uploadSessionAttachment(app.deps, project.id, {
      name: 'notes-å".txt',
      data: bytes,
      mimeType: "text/plain",
    });
    const command: DeviceCommand = {
      type: "session.create",
      input: {
        projectId: project.id,
        title: "Small action",
        attachments: [{ fileId: file.fileId }, { fileId: file.fileId }],
      },
    };
    await withDeviceCommandAttachments(app.deps, project.id, command, async (sent) => {
      expect(sent).toMatchObject({
        attachmentContents: [
          { fileId: file.fileId, name: file.name, mimeType: "text/plain", data: bytes.toString("base64") },
        ],
      });
      if (sent.type !== "session.create") throw new Error("Wrong command");
      expect(sent.attachmentContents).toHaveLength(1);
      expect(Buffer.byteLength(JSON.stringify(sent))).toBeLessThanOrEqual(deviceCommandInputLimit);
      return null;
    });
  } finally {
    await app.close();
  }
});

test.each([
  "growth",
  "missing",
] as const)("bounds attachment reads when the stored blob changes through %s", async (change) => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Changed attachment" });
    const file = await uploadSessionAttachment(app.deps, project.id, {
      name: "context.txt",
      data: Buffer.from([0]),
      mimeType: "text/plain",
    });
    const path = (await app.deps.fileService.get(file.fileId))!.storage_path;
    if (change === "growth") await truncate(path, deviceCommandInputLimit);
    else await rm(path);
    let sent = false;
    await expect(
      withDeviceCommandAttachments(
        app.deps,
        project.id,
        {
          type: "session.create",
          input: { projectId: project.id, title: "Changed blob", attachments: [{ fileId: file.fileId }] },
        },
        async () => {
          sent = true;
          return null;
        },
      ),
    ).rejects.toBeInstanceOf(change === "growth" ? DeviceCommandInputError : DeviceCommandAttachmentError);
    expect(sent).toBe(false);
  } finally {
    await app.close();
  }
});
