# Resource Types

The SDK exports TypeScript types for every platform entity. These match the API response shapes exactly (snake_case field names, same nullability).

Import from `@pstdio/sdk/resources` or `@pstdio/sdk`.

## Project

```ts
type Project = {
  id: string
  name: string
  shorthand: string
  startup_script: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}
```

## Ticket

```ts
type Ticket = {
  id: string
  shorthand: string
  project_id: string
  status_id: string | null
  display_title: string | null
  user_prompt: string | null
  file_id: string | null
  parent_id: string | null
  parallelizable: string | null
  blocked_reason: string | null
  depends_on: string | null
  draft: boolean
  archived: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

type TicketDetail = Ticket & { content: string }

type TicketListItem = Ticket & {
  status_name: string | null
  tag_ids: string[]
  tag_names: string[]
}
```

## Workspace

```ts
type Workspace = {
  id: string
  project_id: string
  name: string
  branch: string | null
  worktree_path: string | null
  attempt_status_id: string | null
  archived: boolean
  workspace_shorthand: string
  startup_log_file_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type WorkspaceListItem = Workspace & {
  ticket_shorthand: string
  attempt_status_name: string | null
}
```

## Session

```ts
type SessionStatus = "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled"

type Session = {
  id: string
  project_id: string | null
  title: string
  status: SessionStatus
  archived: boolean
  created: string | null
  last_request_started: string | null
  last_request_ended: string | null
  agent: string | null
  agent_session_id: string | null
  session_file_id: string | null
  original_session_id: string | null
  cwd: string | null
  created_at: string
  updated_at: string
}
```

## Status

```ts
type Status = {
  id: string
  project_id: string
  name: string
  color: string
  sort_order: number
  is_default: boolean
  can_create: boolean
  can_drag_in: boolean
  can_drag_out: boolean
  column_actions: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type AttemptStatus = {
  id: string
  name: string
  color: string
  sort_order: number
  is_default: boolean
}
```

## Tag

```ts
type TagOption = {
  id: string
  name: string
  color: string
  icon: string | null
  description: string | null
  sort_order: number
}

type Tag = {
  id: string
  project_id: string
  name: string
  type: string
  options: TagOption[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}
```

## Template

```ts
type TemplateType = "prompt" | "ticket" | "document"

type Template = {
  id: string
  project_id: string | null
  name: string
  template_type: string
  file_id: string
  is_default: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type TemplateWithContent = Template & { content: string }
```

## Skill

```ts
type Skill = {
  id: string
  project_id: string
  name: string
  description: string
  file_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

type SkillWithContent = Skill & {
  content: string
  bundled_version: string
  installed_agents: string[]
}
```

## Agent

```ts
type AgentConfig = {
  id: string
  agent_id: string
  is_default: boolean
  config: string
  created_at: string
  updated_at: string
}

type AgentInfo = {
  id: string
  name: string
  availability: { type: "INSTALLED" | "NOT_FOUND" }
}
```

## File

```ts
type FileRecord = {
  id: string
  project_id: string
  file_name: string
  file_kind: string
  storage_path: string
  mime_type: string | null
  size_bytes: number
  hash: string | null
  created_at: string
  updated_at: string
}
```
