import type { CiJob } from "./ci-failures";

interface WorkflowJobDefinition {
  name?: string;
  needs?: string | string[];
  uses?: string;
}
interface WorkflowDefinition {
  jobs: Record<string, WorkflowJobDefinition>;
}
interface Node {
  key: string;
  pattern: RegExp;
  skippedPattern: RegExp;
  needs: string[];
}
const pattern = (name: string) =>
  name
    .split(/\$\{\{.*?\}\}/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".+?");

// Read each workflow at the measured source, including local reusable workflows.
export const bindCiWorkflowGraph = async (jobs: CiJob[], workflow: string, read: (path: string) => Promise<string>) => {
  const nodes: Node[] = [];
  const visit = async (path: string, prefix: string, display: string, inherited: string[], ancestors: string[]) => {
    if (ancestors.includes(path)) throw new Error("Cyclic reusable workflow");
    const definition = Bun.YAML.parse(await read(path)) as WorkflowDefinition;
    for (const [id, job] of Object.entries(definition.jobs)) {
      const key = `${prefix}${id}`;
      const needs = [...inherited, ...[job.needs ?? []].flat().map((need) => `${prefix}${need}`)];
      // Expression-only gate names resolve to one of the repository's existing gate contexts.
      const name =
        id === "ci_passed" && job.name?.startsWith("${{") ? `(?:production_|windows_)?${id}` : pattern(job.name ?? id);
      const label = `${display}${name}`;
      nodes.push({
        key,
        pattern: new RegExp(`^${label}$`),
        skippedPattern: new RegExp(`^${display}${pattern(id)}$`),
        needs,
      });
      if (job.uses?.startsWith("./.github/workflows/"))
        await visit(job.uses.slice(2), `${key}/`, `${label} / `, needs, [...ancestors, path]);
    }
  };
  await visit(`.github/workflows/${workflow}`, "", "", [], []);
  const bindings = jobs.map((job) => ({
    job,
    nodes: nodes.filter(
      (node) => node.pattern.test(job.name) || (job.conclusion === "skipped" && node.skippedPattern.test(job.name)),
    ),
  }));
  if (bindings.some((binding) => binding.nodes.length !== 1)) return jobs;
  return bindings.map(({ job, nodes: [node] }) => ({
    ...job,
    workflowJob: node!.key,
    needs: [
      ...new Set(
        node!.needs.flatMap((key) =>
          bindings
            .filter((binding) => binding.nodes[0]!.key === key || binding.nodes[0]!.key.startsWith(`${key}/`))
            .map((binding) => binding.job.id),
        ),
      ),
    ],
    graphSource: job.sha,
  }));
};

export const executionCriticalPath = (jobs: CiJob[]) => {
  if (!jobs.length || jobs.some((job) => !job.needs || job.graphSource !== job.sha)) return null;
  const byId = new Map(jobs.map((job) => [job.id, job]));
  const paths = new Map<number, { durationMs: number; jobs: number[] }>();
  const pending = new Set(jobs.map((job) => job.id));
  while (pending.size) {
    let progressed = false;
    for (const id of pending) {
      const job = byId.get(id)!;
      if (job.needs!.some((need) => !paths.has(need))) continue;
      const duration = job.conclusion === "skipped" ? 0 : Date.parse(job.completed!) - Date.parse(job.started!);
      if (!Number.isFinite(duration) || duration < 0) return null;
      const predecessors = job.needs!.map((need) => paths.get(need)!);
      const previous = predecessors.sort((a, b) => b.durationMs - a.durationMs)[0] ?? { durationMs: 0, jobs: [] };
      paths.set(id, { durationMs: previous.durationMs + duration, jobs: [...previous.jobs, id] });
      pending.delete(id);
      progressed = true;
    }
    if (!progressed) return null;
  }
  const longest = [...paths.values()].sort((a, b) => b.durationMs - a.durationMs)[0]!;
  return { ...longest, jobs: longest.jobs.map((id) => byId.get(id)!.name) };
};
