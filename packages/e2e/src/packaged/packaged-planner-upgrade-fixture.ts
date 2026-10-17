// Pinned Planner revisions and project data for the packaged Planner upgrade check (PS-626).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../../..");

// The current Planner imports the timeline and standalone filter from published @pstdio/ui 0.43.1.
export const timelinePlannerSource = join(repoRoot, "extensions", "pstdio-planner");

// The last release before the timeline. Its Planner uses @pstdio/ui 0.41, which has no
// collection-view export, so upgrading replaces the installed UI package as the incident did.
const PRE_TIMELINE_RELEASE = "pstdio@0.42.0";

export const writePreTimelinePlanner = (target: string) => {
  mkdirSync(target, { recursive: true });
  const archive = execFileSync("git", ["archive", PRE_TIMELINE_RELEASE, "extensions/pstdio-planner"], {
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  execFileSync("tar", ["-x", "--strip-components=2", "-C", target], { input: archive });
  const path = join(target, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  // This historical fixture does not use ctx.extensionFiles. Its relative file APIs still work on 0.2.
  manifest.engines.pstdio += " || ^0.2.0";
  writeFileSync(path, JSON.stringify(manifest));
};

export const moveLegacyPlannerDrafts = (projectFolder: string) => {
  const owner = join(projectFolder, ".pstdio/extension-storage/pstdio-planner");
  mkdirSync(owner, { recursive: true });
  renameSync(join(projectFolder, ".pstdio/tickets"), join(owner, "tickets"));
};

// Most seeding commands return the stored record with its id.
export type Execute = <T = { id: string }>(command: string, params?: Record<string, unknown>) => Promise<T>;

export const plannerCommands =
  (input: { baseUrl: string; headers: Record<string, string>; projectId: string }): Execute =>
  async <T>(command: string, params: Record<string, unknown> = {}) => {
    const response = await fetch(
      `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
      {
        method: "POST",
        headers: { ...input.headers, "content-type": "application/json" },
        body: JSON.stringify({ params }),
      },
    );
    const body = (await response.json()) as {
      outcome?: { status: string; value?: unknown; error?: { message?: string } };
    };
    if (body.outcome?.status !== "success") throw new Error(`${command}: ${JSON.stringify(body)}`);
    return body.outcome.value as T;
  };

// The incident project had 26 active and 7 archived tickets with two Track values.
export const ACTIVE_CONFLICTS = 26;
export const ARCHIVED_CONFLICTS = 7;

export const seedTrackProject = async (execute: Execute, trackType: "multi_select" | "single_select") => {
  const track = await execute("ticket-tag.create", { name: "Track", type: trackType });
  const product = await execute("ticket-tag.create-option", { tagId: track.id, name: "Product" });
  const platform = await execute("ticket-tag.create-option", { tagId: track.id, name: "Platform" });
  const area = await execute("ticket-tag.create", { name: "Area", type: "multi_select" });
  const ui = await execute("ticket-tag.create-option", { tagId: area.id, name: "UI" });
  const conflict = trackType === "multi_select" ? [product.id, platform.id] : [product.id];
  const create = (index: number, tagIds: string[]) =>
    execute("create-ticket", { content: `# Seeded ticket ${index}\n\nBody ${index}`, tagIds });

  const active = [];
  for (let index = 0; index < ACTIVE_CONFLICTS; index++) active.push(await create(index, [...conflict, ui.id]));
  const archived = [];
  for (let index = 0; index < ARCHIVED_CONFLICTS; index++) archived.push(await create(100 + index, conflict));
  for (const ticket of archived) await execute("archive-ticket", { id: ticket.id });
  // A stored draft keeps its own Track values until someone saves or resolves it.
  const draft = await execute<{ shorthand: string }>("write-ticket", {
    title: "Seeded draft",
    tags: trackType === "multi_select" ? ["Product", "Platform"] : ["Product"],
  });
  await create(200, [platform.id]);
  await create(201, []);
  return { active, archived, area, draft, platform, product, track, ui };
};
