# Adapters and Features

## Overview

The `pstdio` package splits its source code into two top-level directories: `adapters/` and `features/`. This separation keeps delivery mechanisms independent from business logic.

```
packages/pstdio/src/
  adapters/       # How the outside world talks to us
  features/       # What the software actually does
```

## Features

A feature is a self-contained unit of business logic. It knows nothing about how it is invoked — no CLI flags, no HTTP framework types, no React components.

Features contain:

- **Pure logic** — transformations, validations, domain rules
- **API clients** — typed functions that call the pstdio API (`features/<domain>/api/`)
- **File operations** — reading/writing local ticket files, config, docs
- **Types** — domain types shared within the feature

```
features/
  projects/
    api/                            # API client functions
    resolve-project-id.ts           # Resolve project from cwd or explicit ID
  tickets/
    api/                            # API client functions (create, list, update, ...)
    local-ticket.ts                 # Local file operations
    resolve-status-id.ts            # Status name -> ID lookup
    resolve-tag-ids.ts              # Tag names -> IDs lookup
    resolve-ticket-by-shorthand.ts  # Shorthand -> ticket (published or draft)
    display-title.ts
  sessions/
    api/
  config/
    config.ts
  docs/
    reader.ts
    scaffold.ts
```

Features are **imported by adapters**, never the other way around. A feature must never import from `adapters/`.

## Adapters

An adapter translates between an external interface and the features it needs. Each adapter is specific to a delivery mechanism.

Current adapter types:

| Adapter | Delivery mechanism                 |
| ------- | ---------------------------------- |
| `cli`   | Yargs commands (terminal)          |

```
adapters/
  cli/
    commands/         # One directory per domain (tickets/, sessions/, ...)
      tickets/
        create.ts     # Yargs command — parses args, calls features, prints output
        list.ts
    dashboard/        # Dashboard launch helpers
```

An adapter file:

1. Parses or receives input from its delivery mechanism (CLI args, React props)
2. Calls one or more feature functions
3. Formats and returns output for its delivery mechanism

## Rules

1. **Features never import from adapters.** The dependency arrow always points inward: adapter -> feature.
2. **Adapters are thin.** Parsing input, calling features, formatting output. No business logic.
3. **Features are testable in isolation.** They accept plain arguments and return plain values. Adapter-specific types (Yargs `Arguments`, React props) stay in the adapter.
4. **One adapter directory per delivery mechanism.** If a new interface is added (e.g. a REST adapter, a WebSocket adapter), it gets its own directory under `adapters/`.
5. **No duplicated domain logic in adapters.** If multiple adapters need the same logic (e.g. resolving a project ID, looking up a status by name), extract it to a feature function.
