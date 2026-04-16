import type { TargetType } from "../plugins/types";

export type ExecuteActionInput = { target_type: TargetType; target_id: string };
export type ActionResult =
  | { status: "success"; session_id?: string; message?: string }
  | { status: "error"; message: string };
