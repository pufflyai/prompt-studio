import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { command } from "./process";
import type { Pair } from "./types";

const projectContext = async () => {
  let directory = process.cwd();
  for (;;) {
    const config = await Bun.file(join(directory, ".pstdio/config.json"))
      .json()
      .catch(() => null);
    if (config?.project_id) return { projectId: config.project_id as string, workspaceId: config.workspace_id };
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Run from a linked Prompt Studio project");
    directory = parent;
  }
};

// Same public endpoint/authentication as pst. A cold, queued launch can exceed Bun's default idle timeout.
// Keep the finite request allowance; never retry a non-idempotent provisioning request after a lost response.
export const reserve = async (pair: Pair, holder: string, minutes: number) => {
  const context = await projectContext();
  const home = process.env.HOME?.trim() || homedir();
  let configured = process.env.PSTDIO_HOME?.trim() || join(home, ".pstdio");
  if (configured === "~") configured = home;
  else if (configured.startsWith("~/")) configured = join(home, configured.slice(2));
  const operatorHome = resolve(configured);
  const runtime =
    process.env.PSTDIO_API_URL && process.env.PSTDIO_API_TOKEN
      ? undefined
      : JSON.parse(await readFile(join(operatorHome, "runtime.json"), "utf8"));
  const origin = (process.env.PSTDIO_API_URL ?? runtime.origin).replace(/\/$/, "");
  const token =
    process.env.PSTDIO_API_TOKEN ?? (origin === runtime?.origin.replace(/\/$/, "") ? runtime.token : undefined);
  if (!token) throw new Error("No native credential for the configured operator origin");
  const response = await fetch(
    `${origin}/v1/projects/${encodeURIComponent(context.projectId)}/extensions/commands/pocketcoder.remote-testing.command.run/execute`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, origin, "content-type": "application/json" },
      body: JSON.stringify({
        workspaceId: context.workspaceId,
        source: "cli",
        params: {
          path: pair.source,
          command: holder,
          timeoutMinutes: minutes,
          wait: false,
          keepEnvironment: false,
          sessionId: process.env.PSTDIO_SESSION_ID?.trim() || undefined,
        },
      }),
      timeout: false,
      signal: AbortSignal.timeout(20 * 60_000),
    },
  );
  if (!response.ok) throw new Error(`Cloud reservation HTTP ${response.status}; provisioning remains uncertain`);
  const result = await response.json();
  if (!result.outcome?.ok) throw new Error(result.outcome?.reason ?? "Cloud reservation failed");
  const reserved = result.outcome.value;
  if (typeof reserved?.environmentId !== "string" || typeof reserved.runId !== "string")
    throw new Error("Cloud reservation did not return workspace/run identities");
  return reserved as { environmentId: string; runId: string };
};

export const recoverProvisioning = async (pair: Pair, save: () => Promise<void>) => {
  if (!pair.provisioning) return;
  const pending = pair.provisioning;
  const runs = JSON.parse(await command(["pst", "pocketcoder.remote-testing", "runs", "list"])) as Array<{
    command: string;
    runId: string;
    environmentId: string;
  }>;
  const matches = runs.filter((run) => run.command === pending.command);
  if (matches.length !== 1)
    throw new Error(
      "Provisioning response lost; exact holder identity unavailable. Backend retained; repeat down after the holder appears.",
    );
  const run = matches[0]!;
  pair[pending.role] = { workspaceId: run.environmentId, runId: run.runId, pod: "" };
  delete pair.provisioning;
  await save();
};
