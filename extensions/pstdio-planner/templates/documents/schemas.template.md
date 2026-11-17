---
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
---

# Schemas

<!-- Use for proposal review when data shapes affect the decision, and refine during implementation. Use concise bullets, compact examples, or field tables. Keep only relevant entities and sections. Mark existing and proposed shapes clearly; link inspected source for existing behavior. -->

- [Which data shapes change and where they live (DB, API, config, events).]

## Entities

### [Entity name]

- Location: [File path, table name, or service]
- Meaning: [What it represents]
- Owner and lifecycle: [Who creates, changes, and removes it.]
- Status: [Existing or proposed; link the current definition when available.]

| Field  | Type   | Nullable | Notes                            |
| ------ | ------ | -------- | -------------------------------- |
| [name] | [type] | [yes/no] | [constraints, defaults, indexes] |

## Relationships

- [Entity A] → [Entity B]: [cardinality, foreign key, cascade rules]

## Migrations

- [Compatibility, defaults/backfill, and transition or cleanup needed, if any. At proposal time, explain the approach; link migration files once implemented.]

## Invariants

- [Rules the schema must preserve (uniqueness, referential integrity, check constraints)]

## Design choices

- [Show a compact example when it makes a data or relationship choice clearer.]
- [Why this shape was chosen, a meaningful alternative, and the cost or limitation.]
- [Material assumption or unresolved choice that affects review.]
