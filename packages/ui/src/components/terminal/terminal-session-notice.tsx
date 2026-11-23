import type { TerminalSessionError } from "./types";
import "./terminal-session-notice.css";

export const TerminalSessionNotice = ({ error, color }: { error?: TerminalSessionError; color?: string }) => (
  <div className="pstdio-terminal-session-notice" role={error ? "alert" : "status"} style={{ color }}>
    {error ? "Could not open terminal" : "Opening terminal…"}
    {error && <div>{error.message}</div>}
  </div>
);
