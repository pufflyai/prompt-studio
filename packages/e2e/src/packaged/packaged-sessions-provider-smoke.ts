import { expect } from "bun:test";
import type { ChatAttachment, ChatDraft, ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

/** Exercise the installed production provider through the compiled host, without starting an agent. */
export const expectPackagedSessionsProvider = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  metadata: WorkbenchExtensionMetadata;
}) => {
  const { baseUrl, projectId, headers, metadata } = input;
  const chat = metadata.views.find(
    (view) => view.extensionId === "pstdio.pstdio-session-browser" && view.localId === "conversation",
  );
  expect(chat?.body).toMatchObject({ kind: "chat", initial: { messages: [] } });
  if (chat?.body.kind !== "chat") throw new Error("Installed Sessions must expose its native chat renderer.");
  const root = `${baseUrl}/v1/projects/${projectId}/extensions`;
  const execute = async (commandId: string, params: unknown, resource?: ResourceRef) => {
    const response = await fetch(`${root}/commands/${commandId}/execute`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "dashboard", params, ...(resource ? { resource } : {}) }),
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.outcome.ok).toBe(true);
    return result.outcome;
  };
  const list = async () => {
    const response = await fetch(`${baseUrl}/v1/sessions?project_id=${projectId}`, { headers });
    expect(response.status).toBe(200);
    const sessions = await response.json();
    expect(Array.isArray(sessions)).toBe(true);
    return sessions;
  };
  const before = await list();
  for (const side of [false, true]) {
    const outcome = await execute("pstdio.pstdio-session-browser.command.new", { side });
    expect(outcome.navigationRequests).toHaveLength(1);
    const target = outcome.navigationRequests[0];
    expect(target).toMatchObject({
      kind: side ? "panel" : "page",
      resource: { type: "session-draft", extensionId: "pstdio", projectId },
    });
    if (side) expect(target.panel).toMatchObject({ extensionId: "pstdio.pstdio-session-browser", id: "conversation" });
    else expect(target.page).toMatchObject({ extensionId: "pstdio.pstdio-session-browser", id: "draft" });
    const resource = target.resource as ResourceRef;
    const renderer = { rendererId: chat.id, resource };
    const binding = { renderer, draftKey: resource.id };
    const queried = await execute(chat.body.queryHandlerId!, binding, resource);
    expect(queried.value).toMatchObject({
      nativeLinks: true,
      nativeHarnessAccount: { controlId: "harness" },
      values: { harness: { harnessId: "" } },
    });
    const text = `Durable ${side ? "Side" : "Main"} draft`;
    const contents = `Context for ${text}`;
    const uploaded = await execute(
      chat.body.actionHandlerId!,
      {
        ...binding,
        action: {
          type: "upload",
          name: "context.txt",
          mediaType: "text/plain",
          data: Buffer.from(contents).toString("base64"),
        },
      },
      resource,
    );
    const attachment = uploaded.value.attachment as ChatAttachment;
    expect(attachment).toMatchObject({ name: "context.txt", mediaType: "text/plain" });
    const file = await fetch(new URL(attachment.url!, baseUrl), { headers });
    expect(file.status).toBe(200);
    expect(await file.text()).toBe(contents);
    const draft: ChatDraft = { text, attachments: [attachment], values: queried.value.values };
    await execute(chat.body.saveDraftHandlerId!, { ...binding, draft }, resource);
    const restored = await execute(chat.body.loadDraftHandlerId!, binding, resource);
    expect(restored.value).toEqual(draft);
  }
  const inventoryResponse = await fetch(root, { headers });
  expect(inventoryResponse.status).toBe(200);
  const inventory = await inventoryResponse.json();
  const workspaces = inventory.extensions.find(
    (extension: { extensionId: string }) => extension.extensionId === "pstdio.pstdio-workspaces",
  );
  expect(workspaces).toBeDefined();
  const created = await execute("pstdio.pstdio-session-browser.command.new", {});
  const resource = created.navigationRequests[0].resource as ResourceRef;
  const binding = { renderer: { rendererId: chat.id, resource }, draftKey: resource.id };
  const queryHandlerId = chat.body.queryHandlerId!;
  const query = async () => (await execute(queryHandlerId, binding, resource)).value;
  const initial = await query();
  expect(initial.controls.some((control: { id: string }) => control.id === "workspace")).toBe(true);
  const setEnabled = async (enabled: boolean) => {
    const response = await fetch(`${root}/${workspaces.id}`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    expect(response.status).toBe(200);
  };
  await setEnabled(false);
  try {
    const hidden = await query();
    expect(hidden.controls.some((control: { id: string }) => control.id === "workspace")).toBe(false);
    expect(hidden.controls.some((control: { id: string }) => control.id === "device")).toBe(true);
    expect(hidden.workspace).toEqual({ controlId: "workspace", deviceControlId: "device" });
    expect(hidden.workspaceId).toBe(initial.workspaceId);
  } finally {
    await setEnabled(true);
  }
  expect((await query()).controls.some((control: { id: string }) => control.id === "workspace")).toBe(true);
  expect(await list()).toEqual(before);
};
