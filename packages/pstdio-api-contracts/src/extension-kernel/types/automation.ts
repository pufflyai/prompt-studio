import type { AutomationRun, AutomationRunStatus, CreateAutomationRunInput } from "../../automation";
import type { CommandRef } from "./commands";

export type { AutomationRun, AutomationRunStatus } from "../../automation";

export interface ExtensionAutomationApi {
  /** Enqueue a command owned by this extension and declared automation: true. */
  enqueue(input: {
    command: CommandRef | string;
    input: CreateAutomationRunInput["input"];
    /** Required idempotency key, at most 200 characters. */
    key: string;
  }): Promise<AutomationRun>;
  get(runId: string): Promise<AutomationRun | undefined>;
  list(filter?: { status?: AutomationRunStatus[] }): Promise<AutomationRun[]>;
  cancel(runId: string): Promise<AutomationRun>;
}
