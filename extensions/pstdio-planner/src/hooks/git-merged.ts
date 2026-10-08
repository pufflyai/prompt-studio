import { defineHook, gitEvents } from "@pstdio/sdk/extensions";
import { markTicketsDone } from "../data/mark-tickets-done";

export const gitMergedHook = defineHook({
  id: "git-merged-mark-done",
  event: gitEvents.merged,
  async run(ctx, payload) {
    const anchors = [...(payload.anchors ?? []), ...(payload.workspace?.anchors_json ?? [])];
    await markTicketsDone(
      ctx,
      anchors.filter((anchor) => anchor.type === "ticket").map((anchor) => anchor.id),
    );
  },
});
