// Define the ticket-bound human request and response contract.
export interface Question {
  id: string;
  label: string;
  kind: "single-choice" | "multiple-choice" | "text";
  required: boolean;
  options?: Array<{ id: string; label: string }>;
}

export type ActionResponse = { confirmed: true } | { answers: Record<string, string | string[]> };

export interface HumanAction {
  version: 1;
  id: string;
  revision: number;
  title: string;
  instructions: string;
  request: { kind: "task" } | { kind: "decision"; questions: Question[] };
  cancellation?: { at: string; reason: string };
  resolution?: { at: string; response: ActionResponse };
}

export type TicketAction = HumanAction;
