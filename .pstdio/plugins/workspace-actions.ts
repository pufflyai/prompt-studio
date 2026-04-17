import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createSession, definePlugin, runCommand } from "@pstdio/sdk/plugins";

const localComposePath = join("infra", "local", "compose.yaml");
const localProjectService = "prompt-studio";
const localDashboardPort = "5173";
const localApiPort = "19841";
const storybookPackagePath = join("packages", "ui");
const storybookUrl = "http://localhost:6006";
const composeEnvTempPrefix = "pstdio-compose-env-";

const sanitizeComposeProjectPart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const resolveComposeProjectName = (workspaceShorthand: string, workspaceId: string) => {
  const shorthand = sanitizeComposeProjectPart(workspaceShorthand);
  const fallback = sanitizeComposeProjectPart(workspaceId).slice(0, 12);
  return `pstdio-${shorthand || fallback || "workspace"}`;
};

const resolveGitCommonDir = async (worktreePath: string) => {
  const gitCommonDir = await runCommand(worktreePath, ["git", "rev-parse", "--git-common-dir"]);
  if (gitCommonDir.exitCode !== 0) {
    const output = [gitCommonDir.stdout, gitCommonDir.stderr].filter(Boolean).join("\n");
    throw new Error(output || "Failed to resolve the Git common directory for this workspace.");
  }

  return resolve(worktreePath, gitCommonDir.stdout);
};

const createComposeEnvFile = (worktreePath: string, gitCommonDir: string) => {
  const envDir = mkdtempSync(join(tmpdir(), composeEnvTempPrefix));
  const envFilePath = join(envDir, "compose.env");
  const envFile = [
    `HOST_WORKTREE=${JSON.stringify(worktreePath)}`,
    `HOST_GIT_COMMON_DIR=${JSON.stringify(gitCommonDir)}`,
  ].join("\n");

  writeFileSync(envFilePath, `${envFile}\n`);

  return {
    cleanup: () => rmSync(envDir, { recursive: true, force: true }),
    envFilePath,
  };
};

const createComposeCommand = (composeProjectName: string, envFilePath: string, args: string[]) => [
  "docker",
  "compose",
  "-p",
  composeProjectName,
  "--env-file",
  envFilePath,
  "-f",
  localComposePath,
  ...args,
];

const resolvePublishedServiceUrl = async (
  worktreePath: string,
  composeProjectName: string,
  servicePort: string,
  envFilePath: string,
) => {
  const publishedPortResult = await runCommand(
    worktreePath,
    createComposeCommand(composeProjectName, envFilePath, ["port", localProjectService, servicePort]),
  );

  if (publishedPortResult.exitCode !== 0) {
    const output = [publishedPortResult.stdout, publishedPortResult.stderr].filter(Boolean).join("\n");
    throw new Error(output || `Failed to resolve the published port for ${localProjectService}:${servicePort}.`);
  }

  const publishedPort = publishedPortResult.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!publishedPort) {
    throw new Error("Docker did not report a published dashboard port.");
  }

  const separatorIndex = publishedPort.lastIndexOf(":");
  const host =
    separatorIndex === -1 ? "127.0.0.1" : publishedPort.slice(0, separatorIndex).replace(/^\[|\]$/g, "") || "127.0.0.1";
  const port = separatorIndex === -1 ? publishedPort : publishedPort.slice(separatorIndex + 1);

  const normalizedHost = !host || host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return `http://${normalizedHost}:${port}`;
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
        const ticketId = ctx.target.ticket_shorthand as string;

        const session = await createSession(ctx, {
          workspace_id: ctx.target.id,
          title: `Code review: ${ticketId ?? "ticket"}`,
          agent: agent?.agent,
          model: agent?.model,
          template: "code-review",
          vars: { ticket: ticketId },
        });

        return { session_id: session.id };
      },
    },
    {
      key: "run-storybook",
      label: "Run Storybook",
      targetType: "workspace",
      placement: "overflow",
      trigger(ctx) {
        if (!ctx.target.worktree_path) {
          throw new Error("Workspace has no worktree path");
        }

        const uiPath = join(ctx.target.worktree_path, storybookPackagePath);
        if (!existsSync(uiPath)) {
          throw new Error(`Workspace is missing ${storybookPackagePath}`);
        }

        const proc = spawn("bun", ["run", "storybook"], {
          cwd: uiPath,
          detached: true,
          stdio: "ignore",
        });

        if (!proc.pid) {
          throw new Error("Failed to start Storybook. Ensure `bun` is installed and available in PATH.");
        }

        proc.unref();

        return { message: `Storybook is starting at ${storybookUrl}` } as never;
      },
    },
    {
      key: "open-worktree-in-vscode",
      label: "Open in VS Code",
      targetType: "workspace",
      placement: "overflow",
      trigger(ctx) {
        if (!ctx.target.worktree_path) {
          throw new Error("Workspace has no worktree path");
        }

        const result = spawnSync("code", [ctx.target.worktree_path]);
        if (result.error) {
          throw new Error("Failed to open VS Code. Ensure `code` is installed and available in PATH.");
        }
      },
    },
    {
      key: "run-project",
      label: "Run project",
      targetType: "workspace",
      placement: "overflow",
      async trigger(ctx) {
        if (!ctx.target.worktree_path) {
          throw new Error("Workspace has no worktree path");
        }

        const composeFilePath = join(ctx.target.worktree_path, localComposePath);
        if (!existsSync(composeFilePath)) {
          throw new Error(`Workspace is missing ${localComposePath}`);
        }

        const composeProjectName = resolveComposeProjectName(ctx.target.workspace_shorthand, ctx.target.id);
        const gitCommonDir = await resolveGitCommonDir(ctx.target.worktree_path);
        const { cleanup, envFilePath } = createComposeEnvFile(ctx.target.worktree_path, gitCommonDir);

        try {
          const runProject = await runCommand(
            ctx.target.worktree_path,
            createComposeCommand(composeProjectName, envFilePath, [
              "up",
              "-d",
              "--build",
              "--force-recreate",
              "--renew-anon-volumes",
            ]),
          );

          if (runProject.exitCode !== 0) {
            const output = [runProject.stdout, runProject.stderr].filter(Boolean).join("\n");
            throw new Error(output || "Failed to start the local Docker project.");
          }

          const projectUrl = await resolvePublishedServiceUrl(
            ctx.target.worktree_path,
            composeProjectName,
            localDashboardPort,
            envFilePath,
          );

          const apiUrl = await resolvePublishedServiceUrl(
            ctx.target.worktree_path,
            composeProjectName,
            localApiPort,
            envFilePath,
          );

          return {
            message: `Project is starting at ${projectUrl}. API is available at ${apiUrl}.`,
          } as never;
        } finally {
          cleanup();
        }
      },
    },
  ],
});
