import type {
  ChatRendererAction,
  ChatRendererActionResult,
  ExtensionContextBase,
  RendererContext,
} from "@pstdio/sdk/extensions";
import { sessionBrowser } from "../refs";
import { nativeAction } from "./native-actions";
import { queueAction } from "./queue";
import { sessionId, sessionResource } from "./resource";
import { readSnapshot } from "./snapshot";
import { submitMessage } from "./submit-message";
import { submitNativeDraft } from "./submit-native";

const upload = async (ctx: ExtensionContextBase, action: Extract<ChatRendererAction, { type: "upload" }>) => {
  const file = await ctx.sessions.uploadAttachment({
    name: action.name,
    mimeType: action.mediaType,
    data: Uint8Array.from(atob(action.data), (char) => char.charCodeAt(0)),
  });
  return {
    attachment: {
      id: file.fileId,
      name: file.name,
      url: file.url,
      mediaType: file.mimeType ?? undefined,
      size: file.sizeBytes,
    },
  };
};
const requireSession = (id?: string) => {
  if (!id) throw new Error("Start a conversation before using this control.");
  return id;
};
export const act = async (
  ctx: ExtensionContextBase,
  input: { renderer: RendererContext; action: ChatRendererAction; draftKey: string },
): Promise<ChatRendererActionResult> => {
  const { action, renderer } = input;
  const resource = renderer.resource;
  const id = sessionId(resource);
  const native = await nativeAction(ctx, id, action);
  if (native) return native;
  const submitted = await submitNativeDraft(ctx, id, resource, action);
  if (submitted) return submitted;
  switch (action.type) {
    case "upload":
      return upload(ctx, action);
    // Removing a chip releases a draft reference; another draft or submitted message may still use the file.
    case "deleteAttachment":
      return {};
    case "openResource": {
      const [opening] = await ctx.resources.resolveOpenings([
        {
          type: "workspace",
          extensionId: "pstdio",
          projectId: ctx.projectId,
          id: action.id,
        },
      ]);
      if (!opening?.target) throw new Error("The configured workspace opener is unavailable.");
      ctx.navigation.open(opening.target);
      return {};
    }
    case "openLink":
      throw new Error("This link is unavailable in the session workspace.");
    case "control":
      return {
        snapshot: await readSnapshot(
          ctx,
          resource,
          action.id === "device" ? { ...action.values, workspace: "" } : action.values,
        ),
      };
    case "submit":
      await submitMessage(ctx, id, resource, action);
      // The new resource owns its transcript; this draft has no canonical echo to await.
      return id ? {} : { snapshot: { messages: [], streaming: false } };
    case "fork": {
      const fork = await ctx.sessions.fork(requireSession(id), action.messageId);
      ctx.navigation.open({
        kind: "page",
        resource: sessionResource(fork, ctx.projectId),
        page: sessionBrowser.pages.session,
      });
      return {};
    }
    case "stop":
      await ctx.sessions.stop(requireSession(id));
      break;
    case "approve":
      if (action.choice !== "approve" && action.choice !== "deny") throw new Error("Choose Allow or Deny.");
      await ctx.sessions.approve(requireSession(id), { id: action.id, decision: action.choice });
      return { snapshot: { approval: null } };
    case "queue":
      await queueAction(ctx.sessions, requireSession(id), action);
      break;
    case "operation":
      if (action.id !== "refresh-queue") throw new Error("This conversation control is unavailable.");
      break;
    default:
      throw new Error("This conversation control is unavailable.");
  }
  return { snapshot: await readSnapshot(ctx, resource) };
};
