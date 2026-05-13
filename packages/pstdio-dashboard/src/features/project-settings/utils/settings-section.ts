export type SettingsSection =
  | "ticket-statuses"
  | "attempt-statuses"
  | "tags"
  | "extensions"
  | "danger-zone"
  | "repositories"
  | "agents"
  | { tag: string }
  | { template: string }
  | { skill: string };
