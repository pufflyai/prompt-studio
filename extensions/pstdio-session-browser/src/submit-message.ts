import type { ChatRendererAction, ExtensionContextBase, ResourceRef } from "@pstdio/sdk/extensions";
import { sessionBrowser } from "../refs";
import { sessionResource } from "./resource";
import { selectedHarness, selectedWorkspace } from "./selection";

export const submitMessage = async (
  ctx: ExtensionContextBase,
  id: string | undefined,
  resource: ResourceRef | undefined,
  action: Extract<ChatRendererAction, { type: "submit" }>,
) => {
  if (/^\/(?:login|logout)(?:\s|$)/.test(action.text))
    throw new Error("Use the harness account control to sign in or out.");
  const harness = selectedHarness(action.values);
  const attachments = action.attachments.map((attachment) => ({ file_id: attachment.id }));
  if (id) {
    await ctx.sessions.followup({
      sessionId: id,
      prompt: action.text || undefined,
      attachments: action.questionResponse ? [] : attachments,
      harness,
      questionResponse: action.questionResponse,
    });
    return;
  }
  const created = await ctx.sessions.create({
    title: action.text.slice(0, 100) || "Session",
    prompt: action.text,
    harness,
    workspaceId: selectedWorkspace(action.values),
    deviceId: typeof action.values.device === "string" && action.values.device ? action.values.device : undefined,
    attachments,
  });
  // The host persists its guarded post-submit draft even after this placement unmounts.
  ctx.navigation.open({
    kind: "viewer",
    operation: "replace",
    from: resource,
    resource: sessionResource(created, ctx.projectId),
    page: sessionBrowser.pages.session,
  });
};
