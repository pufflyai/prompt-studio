import { readFileSync } from "node:fs";
import {
  focusCount,
  focusFilter,
  focusViewTitle,
  stressTicketCount,
  stressTicketInput,
  stressTicketsInOrder,
  trackNames,
} from "./planner-stress-data";

interface Connection {
  apiPort: number;
  apiToken: string;
  dashboardUrl: string;
}

type Execute = <T>(command: string, params?: Record<string, unknown>) => Promise<T>;
interface Ticket {
  id: string;
  title: string;
}
interface Tag {
  name: string;
  options: { id: string; name: string }[];
}

async function seedPlannerStress(execute: Execute, progress: (count: number) => void) {
  const tickets = stressTicketsInOrder(await execute<Ticket[]>("read-tickets"));
  const { tags } = await execute<{ tags: Tag[] }>("ticket-tag.read");
  const tracks: string[] = [];
  for (const name of trackNames) {
    const existing = tags.find((tag) => tag.name === "Track")?.options.find((option) => option.name === name);
    const track = existing ?? (await execute<{ id: string }>("timeline.track.create", { name }));
    tracks.push(track.id);
  }
  progress(tickets.length);
  for (let index = tickets.length; index < stressTicketCount; index++) {
    tickets.push(await execute<Ticket>("create-ticket", stressTicketInput(index, tickets, tracks)));
    if (tickets.length % 100 === 0) progress(tickets.length);
  }
  const { views } = await execute<{ views: { id: string; title: string }[] }>("timeline.views.read");
  const value = { title: focusViewTitle, filter: focusFilter };
  let view = views.find((entry) => entry.title === focusViewTitle);
  if (view) await execute("timeline.views.update", { id: view.id, value });
  else view = await execute<{ id: string; title: string }>("timeline.views.create", { value });
  await execute("timeline.views.default", { id: view.id });
  return { tickets: tickets.length, matching: focusCount, viewId: view.id, viewTitle: focusViewTitle };
}

async function main() {
  const [connectionPath] = process.argv.slice(2);
  if (!connectionPath) throw new Error("Pass the isolated stack's connection.json path.");
  const connection = JSON.parse(readFileSync(connectionPath, "utf8")) as Connection;
  const baseUrl = `http://127.0.0.1:${connection.apiPort}`;
  const headers = { authorization: `Bearer ${connection.apiToken}`, "content-type": "application/json" };
  const projectsReply = await fetch(`${baseUrl}/v1/projects`, { headers });
  if (!projectsReply.ok) throw new Error(`Reading isolated projects failed: HTTP ${projectsReply.status}`);
  const projects = (await projectsReply.json()) as { id: string; name: string }[];
  const project = projects.find((entry) => entry.name === "project");
  if (!project) throw new Error("The isolated demo project is missing.");
  const execute: Execute = async <T>(command: string, params: Record<string, unknown> = {}) => {
    const response = await fetch(
      `${baseUrl}/v1/projects/${project.id}/extensions/commands/pstdio.pstdio-planner.command.${command}/execute`,
      { method: "POST", headers, body: JSON.stringify({ params }) },
    );
    const body = await response.json();
    if (!response.ok || body.outcome?.status !== "success") {
      throw new Error(`${command}: ${body.outcome?.error?.message ?? `HTTP ${response.status}`}`);
    }
    return body.outcome.value as T;
  };
  const start = performance.now();
  const fixture = await seedPlannerStress(execute, (count) =>
    process.stderr.write(`Planner stress tickets: ${count}/${stressTicketCount}\n`),
  );
  const timelineUrl = `${connection.dashboardUrl.replace(/\/$/, "")}/projects/${project.id}/extensions/pstdio.pstdio-planner/ticket-timeline`;
  process.stdout.write(
    `${JSON.stringify({ ...fixture, projectId: project.id, timelineUrl, seedMs: Math.round(performance.now() - start) })}\n`,
  );
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
