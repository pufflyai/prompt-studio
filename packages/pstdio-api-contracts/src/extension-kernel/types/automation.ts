import type { AutomationRun, AutomationRunStatus, CreateAutomationRunInput } from "../../automation";
import type { CommandRef } from "./commands";

export type { AutomationRun, AutomationRunStatus } from "../../automation";
export interface AutomationRunFilter {
  status?: AutomationRunStatus[];
  commandId?: string;
  limit?: number;
  order?: "oldest" | "newest";
}

export interface ExtensionAutomationApi {
  /** Enqueue a command owned by this extension and declared automation: true. */
  enqueue(input: {
    command: CommandRef | string;
    input: CreateAutomationRunInput["input"];
    /** Required idempotency key, at most 200 characters. */
    key: string;
  }): Promise<AutomationRun>;
  get(runId: string): Promise<AutomationRun | undefined>;
  /** Use a limit and command filter for activity previews. */
  list(filter?: AutomationRunFilter): Promise<AutomationRun[]>;
  cancel(runId: string): Promise<AutomationRun>;
}
