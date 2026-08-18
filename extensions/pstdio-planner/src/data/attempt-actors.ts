import type { CommandSource } from "@pstdio/sdk/extensions";
import type { ActorRef } from "./attempt-types";

export const actorFromSource = (source: CommandSource | undefined, id = "planner-command"): ActorRef => {
  if (source === "schedule" || source === "automation" || source === "event") {
    return { type: "automation", id, displayName: "Planner automation" };
  }
  if (source === "cli") return { type: "agent", id, displayName: "Agent" };
  return { type: "human", id, displayName: "Human" };
};
