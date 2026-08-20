---
user_prompt: "{{USER_PROMPT}}"
created: "{{CREATED_AT}}"
---

# Schemas

[What data shapes are relevant to this ticket and where they live (DB, API, config, events).]

## Entities

### [Entity name]

- Location: [File path, table name, or service]
- Meaning: [What it represents]

| Field  | Type   | Nullable | Notes                            |
| ------ | ------ | -------- | -------------------------------- |
| [name] | [type] | [yes/no] | [constraints, defaults, indexes] |

## Relationships

- [Entity A] → [Entity B]: [cardinality, foreign key, cascade rules]

## Migrations

- [Migration file or step needed, if any]

## Invariants

- [Rules the schema must preserve (uniqueness, referential integrity, check constraints)]
