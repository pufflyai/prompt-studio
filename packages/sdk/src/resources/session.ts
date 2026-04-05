export type SessionStatus = "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled";

export type Session = {
  id: string;
  project_id: string | null;
  title: string;
  status: SessionStatus;
  archived: boolean;
  last_request_started: string | null;
  last_request_ended: string | null;
  agent: string | null;
  agent_session_id: string | null;
  session_file_id: string | null;
  original_session_id: string | null;
  cwd: string | null;
  created_at: string;
  updated_at: string;
};
