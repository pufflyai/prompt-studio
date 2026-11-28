import { contributionRefId, sessionBrowser, workbenchCommands } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { seedChatBrowserDraft } from "@pstdio/workbench/extensions";
import { dashboardChatDraftScope, dashboardChatDraftStorage } from "@/shared/app/chat-draft-storage";

export const registerOpenSessionDraft = (ctx: WorkbenchModuleContext) =>
  ctx.commands.registerCommand<{ text: string; label?: string }>(
    {
      id: workbenchCommands.openSessionDraft.id,
      label: "Open session draft",
    },
    {
      async execute(input) {
        const projectId = ctx.pages.store.getState().projectId;
        const viewId = contributionRefId(sessionBrowser.views.conversation);
        if (!projectId || !ctx.views.getView(viewId)) throw new Error("The session composer is unavailable here.");
        if (typeof input?.text !== "string" || !input.text.trim() || input.text.length > 32000)
          throw new Error("A session draft needs text of at most 32,000 characters.");
        const resource = {
          id: `new-${crypto.randomUUID()}`,
          type: "session-draft",
          extensionId: "pstdio",
          projectId,
          label: input.label?.slice(0, 200) ?? "New session",
        };
        const discardUnopened = seedChatBrowserDraft({
          workbench: ctx,
          resource,
          viewId,
          extensionId: sessionBrowser.views.conversation.extensionId,
          storageScope: dashboardChatDraftScope(),
          storage: dashboardChatDraftStorage(),
          draft: { text: input.text, attachments: [], values: {} },
        });
        try {
          await ctx.navigation.openTarget({
            kind: "panel",
            panel: sessionBrowser.panels.conversation,
            resource,
            open: "pin",
          });
        } catch (error) {
          discardUnopened();
          throw error;
        }
        if (ctx.sidePanel.getMode() === "closed") ctx.sidePanel.setMode("floating");
      },
    },
  );
