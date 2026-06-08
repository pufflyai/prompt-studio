# Resource Types

The SDK exports TypeScript types for core platform entities. These match the API
response shapes exactly (snake_case field names, same nullability).

Planner tickets, ticket statuses, and ticket tags are extension-owned. Their
types live with the planner extension command contracts, not in
`@pstdio/sdk/resources`.

Import from `@pstdio/sdk/resources` or `@pstdio/sdk`.

## Project

```ts
type Project = {
  id: string;
  name: string;
  shorthand: string;
  startup_script: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
```

## Workspace

```ts
type Workspace = {
  id: string;
  project_id: string;
  name: string;
  branch: string | null;
  worktree_path: string | null;
  is_default: boolean;
  archived: boolean;
  workspace_shorthand: string;
  startup_log_file_id: string | null;
  anchors_json: unknown[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type WorkspaceListItem = Workspace & {
  ticket_shorthand: string | null;
};
```

## Session

```ts
type SessionStatus =
  | "queued"
  | "in_progress"
  | "awaiting_input"
  | "completed"
  | "failed"
  | "cancelled"
  | "disconnected";

type Session = {
  id: string;
  project_id: string | null;
  title: string;
  status: SessionStatus;
  archived: boolean;
  created: string | null;
  last_request_started: string | null;
  last_request_ended: string | null;
  agent: string | null;
  agent_session_id: string | null;
  session_file_id: string | null;
  original_session_id: string | null;
  cwd: string | null;
  created_at: string;
  updated_at: string;
};
```

## Template

```ts
type TemplateType = "prompt" | "ticket" | "document";

type Template = {
  id: string;
  project_id: string | null;
  name: string;
  template_type: string;
  file_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type TemplateWithContent = Template & { content: string };
```

## Skill

```ts
type SkillFile = {
  path: string;
  content: string;
  encoding: "utf8";
};

type Skill = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  files: SkillFile[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type SkillWithContent = Skill & {
  bundled_version: string;
  installed_agents: string[];
};
```

Notes:

- `files` is an ordered file-tree payload relative to the skill root.
- `SKILL.md` is the required entrypoint file for valid skills.

## Agent

```ts
type AgentConfig = {
  id: string;
  agent_id: string;
  is_default: boolean;
  config: string;
  created_at: string;
  updated_at: string;
};

type AgentInfo = {
  id: string;
  name: string;
  availability: { type: "INSTALLED" | "NOT_FOUND" };
};
```

## File

```ts
type FileRecord = {
  id: string;
  project_id: string;
  file_name: string;
  file_kind: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number;
  hash: string | null;
  created_at: string;
  updated_at: string;
};
```
