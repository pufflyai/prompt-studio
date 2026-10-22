import { expect } from "bun:test";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";

export const expectPackagedTicketImages = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
}) => {
  const execute = async (command: string, params: unknown) => {
    const response = await fetch(
      `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
      {
        method: "POST",
        headers: { ...input.headers, "content-type": "application/json" },
        body: JSON.stringify({ params }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome.status, JSON.stringify(body)).toBe("success");
    return body.outcome.value;
  };
  const draft = await execute("write-ticket", { title: "Screenshot proof" });
  const path = join(dirname(draft.path), "files", "proof.png");
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xfe]);
  await Bun.write(path, bytes);
  await execute("save-ticket", { id: draft.shorthand });
  const saved = await execute("get-ticket", { id: draft.shorthand });
  expect(saved.files).toEqual([]);
  expect(saved.attachments).toEqual([expect.objectContaining({ name: "proof.png", mimeType: "image/png" })]);
  expect(await execute("list-ticket-files", { id: draft.shorthand })).toContainEqual(
    expect.objectContaining({ file: "proof.png", storage: "yes", local: "yes" }),
  );
  await rm(path);
  await execute("pull-ticket", { id: draft.shorthand, force: true });
  expect(new Uint8Array(await Bun.file(path).arrayBuffer())).toEqual(bytes);
  await execute("delete-ticket", { id: draft.shorthand });
};
