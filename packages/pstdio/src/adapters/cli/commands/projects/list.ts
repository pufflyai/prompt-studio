import { listProjects as defaultListProjects } from "@/features/projects/api/list-projects";

type Deps = {
  listProjects: typeof defaultListProjects;
  log: (msg: string) => void;
};

const defaultDeps: Deps = {
  listProjects: defaultListProjects,
  log: console.log,
};

export const command = "list";
export const describe = "List all projects";

const formatDate = (iso: string) => iso.slice(0, 10);

const formatTable = (projects: Awaited<ReturnType<typeof defaultListProjects>>) => {
  const header = { id: "ID", name: "Name", created: "Created" };
  const rows = projects.map((p) => ({ id: p.id, name: p.name, created: formatDate(p.created_at) }));

  const widths = {
    id: Math.max(header.id.length, ...rows.map((r) => r.id.length)),
    name: Math.max(header.name.length, ...rows.map((r) => r.name.length)),
    created: Math.max(header.created.length, ...rows.map((r) => r.created.length)),
  };

  const pad = (s: string, w: number) => s.padEnd(w);
  const line = (r: { id: string; name: string; created: string }) =>
    `${pad(r.id, widths.id)}   ${pad(r.name, widths.name)}   ${pad(r.created, widths.created)}`;

  return [line(header), ...rows.map(line)].join("\n");
};

export const createHandler =
  (deps: Deps = defaultDeps) =>
  async () => {
    const projects = await deps.listProjects();

    if (projects.length === 0) {
      deps.log("No projects found. Run `pstdio projects create [name]` to create one.");
      return;
    }

    deps.log(formatTable(projects));
  };

export const handler = createHandler();
