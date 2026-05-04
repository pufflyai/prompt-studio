# Hook Contexts

Every hook receives a typed `ctx` object as its only argument. All contexts extend `BaseHookContext`, which carries the `client` (a `PstdioClient` with a `session.followup()` helper) and `projectId`. The shapes below match the SDK exports in `@pstdio/sdk/plugins`.

## BaseHookContext

```ts
type BaseHookContext = {
  client: HookClient;   // PstdioClient + session.followup()
  projectId: string;
  payload?: Record<string, unknown>;
};
```

## Ticket Contexts

```ts
type TicketContext = BaseHookContext & {
  id: string;
  shorthand: string;
  displayTitle: string | null;
  userPrompt: string | null;
  parentId: string | null;
  draft: boolean;
  archived: boolean;
  status: string | null;
  tagIds: string[];
  tagNames: string[];
  fileIds: string[];
};

type TicketCreationContext = Omit<TicketContext, "id" | "shorthand"> & {
  id: null;
  shorthand: null;
  content: string | null;
};

type TicketStatusChangeContext = TicketContext & {
  fromStatus: string | null;
  toStatus: string | null;
};
```

Used by: `preTicketCreation` (creation ctx), `postTicketCreation` / `preTicketArchive` / `postTicketArchive` / `preTicketDeletion` / `postTicketDeletion` (ticket ctx), `preTicketStatusChange` / `postTicketStatusChange` (status change ctx).

## Worktree Contexts

```ts
type WorktreeCreateContext = BaseHookContext & {
  repoPath: string;
  worktreePath: string;
  branch: string;
  workspace: string;
  ticket: string;
  base: string;
};

type WorktreeContext = BaseHookContext & {
  repoPath: string;
  worktreePath: string;
  branch: string;
  workspace: string;
  workspaceId: string;
  ticket: string;
};

type WorktreeRemoveContext = {
  repoPath: string;
  worktreePath: string | null;
  branch: string;
  workspace: string;
  workspaceId: string;
  ticket: string | null;
  projectId: string;
};
```

Used by: `preWorktreeCreate` (create ctx), `postWorktreeCreate` (worktree ctx), `preWorktreeRemove` / `postWorktreeRemove` (remove ctx). Note that `WorktreeRemoveContext` carries `projectId` directly and does not inherit `BaseHookContext`.

## Commit / Rebase / Merge / Conflict Contexts

```ts
type CommitContext = {
  repoPath: string;
  worktreePath: string;
  commitMessage: string;
  stagePolicy: string;
  commitSha?: string;
};

type RebaseContext = {
  repoPath: string;
  branch: string;
  target: string;
};

type MergeContext = {
  repoPath: string;
  branch: string;
  target: string;
  squash: boolean;
  commitMessage: string | null;
  commitSha?: string;
};

type ConflictContext = {
  repoPath: string;
  branch: string;
  target: string;
  operation: "rebase" | "merge";
};
```

Used by: `preCommit` / `postCommit`, `preRebase` / `postRebase`, `preMerge` / `postMerge`, `onConflict`. These contexts do not extend `BaseHookContext` — they are git-event oriented and do not carry the API client.

## Session Context

```ts
type SessionHookContext = BaseHookContext & {
  sessionId: string;
  sessionStatus: "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled" | "disconnected";
  originalSessionId?: string;
  workspace?: HookWorkspace;
  workspaceId?: string;
  worktreePath?: string;
  branch?: string;
  ticket?: HookTicket;
  attemptStatus?: string;
};
```

Used by: `postSessionStart`, `postSessionSuccess`, `postSessionFail`, `postSessionResume`, `postSessionAwaitInput`.

`HookTicket` is `Ticket & { status_name: string | null }`. `HookWorkspace` is `Workspace & { ticket_shorthand: string; attempt_status_name: string | null }`.

## Attempt Status Change Context

```ts
type AttemptStatusChangeContext = BaseHookContext & {
  workspace: HookWorkspace;
  workspaceId: string;
  prompts: Record<string, string>;
  ticket?: HookTicket;
  worktreePath?: string;
  branch?: string;
  fromStatus: string;
  toStatus: string;
  sessionId?: string;
  originalSessionId?: string;
};
```

Used by: `preAttemptStatusChange`, `postAttemptStatusChange`.

## Return Types

```ts
type HookResponse = { reject?: boolean; reason?: string; data?: Record<string, unknown> };
type PreHookReturn = HookResponse | undefined | Promise<HookResponse | undefined>;
type PostHookReturn = void | Promise<void>;
```

Pre-hooks that return `{ reject: true, reason }` abort the parent operation and surface `reason` to the caller.
