import { commandEvent, defineHook } from "@pstdio/sdk/extensions";
import { commands } from "./commands";
import { settleFailedDraft } from "./draft-commands";
import { draftChapterFor } from "./forms";

export const authoringDraftFailed = defineHook({
  id: "authoring-draft-failed",
  event: commandEvent(commands["drafts.submit"].ref, "failed"),
  async run(ctx, event) {
    const { workspaceId, chapter, mode } = event.params;
    if (
      typeof workspaceId !== "string" ||
      typeof chapter !== "number" ||
      (mode !== "rule" && mode !== "finding" && mode !== "chapter")
    )
      return;
    await settleFailedDraft(ctx, {
      workspaceId,
      chapter: draftChapterFor(mode, chapter),
      invocationId: event.invocationId,
    });
  },
});
