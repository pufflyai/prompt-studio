import type { CommandContext, ExtensionStorageApi } from "@pstdio/sdk/extensions";

type CommandContextOverrides<TParams extends Record<string, unknown>> = {
  [K in keyof CommandContext<TParams>]?: Partial<CommandContext<TParams>[K]>;
};

interface CommandContextInput<TParams extends Record<string, unknown>> {
  storage: ExtensionStorageApi;
  params: TParams;
  projectId?: string;
  overrides?: CommandContextOverrides<TParams>;
}

const reviewTemplate = {
  id: "template-review",
  project_id: "proj-1",
  name: "review",
  title: "Review",
  template_type: "report",
  source_kind: "extension",
  is_default: false,
  editable: false,
  content: "## Confidence Score\n",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

export const makeCommandContext = <TParams extends Record<string, unknown>>({
  overrides,
  storage,
  params,
  projectId = "proj-1",
}: CommandContextInput<TParams>) =>
  ({
    extensionId: "pstdio-reports",
    name: "pstdio-reports",
    storage,
    projectId,
    project: { id: projectId, name: "Test Project", shorthand: "T" },
    params,
    events: { emit: async () => ({ delivered: 0 }) },
    templates: { get: async (name: string) => (name === "review" ? reviewTemplate : null) },
    notify: { action: async () => ({}), dismiss: async () => [], resolve: async () => [], toast: async () => {} },
    workspaces: { list: async () => [], get: async () => null, getByShorthand: async () => null },
    sessions: { list: async () => [] },
    ...overrides,
  }) as unknown as CommandContext<TParams>;
