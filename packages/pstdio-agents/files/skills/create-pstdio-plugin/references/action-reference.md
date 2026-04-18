# Action Plugin Reference

Actions are declared via `definePlugin({ actions: [...] })` and appear in ticket/workspace/session UI placements.

## Action Shape

```ts
type TargetType = "ticket" | "workspace" | "session";
type ActionPlacement = "primary" | "secondary" | "overflow";

type ActionInput = {
  key: string;
  label: string;
  targetType: TargetType;
  placement: ActionPlacement;
  params?: ActionParamDef[];
  trigger: (ctx: ActionTriggerContext) =>
    | void
    | { session_id?: string; message?: string }
    | Promise<{ session_id?: string; message?: string } | undefined>;
};
```

## Trigger Context

```ts
type ActionTriggerContext = {
  client: PstdioClient;
  projectId: string;
  prompts: Record<string, string>;
  params: Record<string, ActionParamValue>;
  targetType: "ticket" | "workspace" | "session";
  targetId: string;
  target: TicketListItem | WorkspaceListItem | Session;
};
```

## Param Types

- `text`
- `longtext`
- `select`
- `template-select`
- `agent`
- `repo`

Each param supports `key`, `label`, optional `description`, `required`, and `defaultValue`.

## Returning Results

Action trigger may return:

- nothing (`void`)
- `{ message }` for lightweight feedback
- `{ session_id }` to route users to a session
- `{ session_id, message }` for both

## Conventions

- Keep action `key` stable over time.
- Keep labels user-facing and concise.
- Prefer one action per clear intent.
- Avoid heavy sync work in triggers; delegate to sessions for long flows.
