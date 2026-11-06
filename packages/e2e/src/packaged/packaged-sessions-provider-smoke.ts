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
  expect(chat?.body).toMatchObject({ kind: "chat", initial: { messages: [], values: { harness: { harnessId: "" } } } });
  if (chat?.body.kind !== "chat") throw new Error("Installed Sessions must expose its native chat renderer.");
  const root = `${baseUrl}/v1/projects/${projectId}/extensions`;
  const execute = async (commandId: string, params: unknown, resource?: ResourceRef) => {
    const response = await fetch(`${root}/commands/${commandId}/execute`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ params, ...(resource ? { resource } : {}) }),
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
  expect(await list()).toEqual(before);
};
