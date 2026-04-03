import { execFileSync } from "node:child_process";

const resolvePstdioSessionId = async (input) => {
  const args = [
    "sessions",
    "resolve-session-id",
    "--agent",
    "opencode",
    "--agent-session-id",
    input.sessionID,
    "--json",
  ];

  if (input.cwd) {
    args.push("--cwd", input.cwd);
  }

  const stdout = execFileSync("pstdio", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  const body = JSON.parse(stdout);
  if (!body || typeof body !== "object") {
    return null;
  }

  const sessionId = body.session_id;
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    return null;
  }

  return sessionId;
};

export const PstdioSessionBridgePlugin = async (deps = {}) => {
  const resolveSessionId = deps.resolveSessionId ?? resolvePstdioSessionId;

  return {
    "shell.env": async (input, output) => {
      if (!input.sessionID) {
        return;
      }

      try {
        const sessionId = await resolveSessionId(input);
        if (!sessionId) {
          return;
        }

        output.env.PSTDIO_SESSION_ID = sessionId;
      } catch {
        // Keep shell execution non-blocking when mapping fails.
      }
    },
  };
};
