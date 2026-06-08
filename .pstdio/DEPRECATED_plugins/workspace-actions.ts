import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { connect, createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { createSession, definePlugin } from "@pstdio/sdk/plugins";

const APP_PREFERRED_PORTS: Record<string, number> = {
  frontend: 8080,
  "frontend-nxt": 8081,
};

// Bind without specifying a host so the OS attempts an all-interfaces bind.
// On macOS, listening only on 127.0.0.1 succeeds even when another process
// already holds *:port via IPv6 (e.g. Docker port mappings) — which would
// then make us hand off a "free" port that vite cannot actually bind.
const isPortFree = (port: number) =>
  new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });

const findFreePort = async (start: number, attempts = 50) => {
  for (let port = start; port < start + attempts; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found in range ${start}-${start + attempts - 1}`);
};

const waitForPort = async (port: number, timeoutMs = 60_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise<boolean>((resolve) => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (ready) return true;
    await sleep(500);
  }
  return false;
};

export default definePlugin({
  actions: [
    // ──────────────────────────────────────────────────────────
    // Creates a manual code-review session
    // scoped to the selected workspace.
    // ──────────────────────────────────────────────────────────
    {
      key: "run-review",
      label: "Run review",
      targetType: "workspace",
      placement: "secondary",
      params: [{ key: "agent", label: "Agent", type: "agent" }],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const ticketId = ctx.target.ticket_shorthand || null;

        await createSession(ctx, {
          workspace_id: ctx.target.id,
          title: `Code review: ${ticketId ?? "ticket"}`,
          agent: agent?.agent,
          model: agent?.model,
          template: "review-code",
          vars: ticketId ? { ticket: ticketId } : {},
        });
      },
    },

    // ──────────────────────────────────────────────────────────
    // Opens the workspace's worktree in VS Code.
    // ──────────────────────────────────────────────────────────
    {
      key: "open-vscode",
      label: "Open in VS Code",
      targetType: "workspace",
      placement: "secondary",
      async trigger(ctx) {
        const worktreePath = ctx.target.worktree_path;
        if (!worktreePath) {
          return {
            message: "Workspace has no worktree — create one before opening in VS Code.",
          };
        }

        spawn("code", [worktreePath], {
          detached: true,
          stdio: "ignore",
        }).unref();

        return { message: `Opening ${worktreePath} in VS Code.` };
      },
    },

    // ──────────────────────────────────────────────────────────
    // Starts the Vite dev server for the selected workspace's worktree.
    // The choice between `frontend/` and `frontend-nxt/` is exposed as a
    // param so the same action covers both apps.
    // ──────────────────────────────────────────────────────────
    {
      key: "start-frontend",
      label: "Start frontend",
      targetType: "workspace",
      placement: "secondary",
      params: [
        {
          key: "app",
          label: "App",
          type: "select",
          required: true,
          defaultValue: "frontend",
          options: [
            { value: "frontend", label: "frontend" },
            { value: "frontend-nxt", label: "frontend-nxt" },
          ],
        },
      ],
      async trigger(ctx) {
        const worktreePath = ctx.target.worktree_path;
        if (!worktreePath) {
          return {
            message: "Workspace has no worktree — create one before starting the frontend.",
          };
        }

        const app = (ctx.params.app as string) ?? "frontend";
        const appPath = join(worktreePath, app);
        if (!existsSync(join(appPath, "package.json"))) {
          return { message: `No package.json at ${app}/ in worktree.` };
        }

        const port = await findFreePort(APP_PREFERRED_PORTS[app] ?? 8080);
        const url = `http://localhost:${port}`;

        const child = spawn("yarn", ["dev", "--port", String(port), "--strictPort"], {
          cwd: appPath,
          detached: true,
          stdio: "ignore",
          env: { ...process.env },
        });
        child.unref();

        const ready = await waitForPort(port);
        if (ready) {
          spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
          return {
            message: `Started ${app} at ${url} (pid ${child.pid}). Opening in browser.`,
          };
        }

        return {
          message: `Started \`yarn dev\` in ${app}/ (pid ${child.pid}) but ${url} did not respond within 60s.`,
        };
      },
    },
  ],
});
