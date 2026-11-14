import type { Request } from "@playwright/test";

export const sessionChatActionCommandId = "pstdio.session-browser.view.conversation.chat.onAction";
export const sessionChatActionPath = `/extensions/commands/${sessionChatActionCommandId}/execute`;
export const sessionChatActionRoute = `**${sessionChatActionPath}`;
export const isSessionChatAction = (request: Request, type: string) =>
  request.method() === "POST" &&
  request.url().endsWith(sessionChatActionPath) &&
  request.postDataJSON()?.params?.action?.type === type;
