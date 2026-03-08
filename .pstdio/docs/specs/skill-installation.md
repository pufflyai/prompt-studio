# Skill Installation

## Purpose

Ensure that when a project is created and a repo is registered — whether from the CLI or the dashboard — all bundled skills are seeded to the database and installed to the repo's filesystem for each configured agent.

---

## Concepts

| Term            | Definition                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| Bundled skill   | A default skill shipped inside the `pstdio-agents` package. Read-only source of truth.    |
| DB skill        | A skill record stored in the `skills` table, scoped to a project. Users can modify these. |
| Installed skill | A `SKILL.md` file written to a repo under an agent's skills directory.                    |
| Skill seeding   | Creating DB skill records from the bundled skill set for a given project.                 |
| Skill install   | Writing a DB skill's content to the repo filesystem for each configured agent.            |

---

## Behavior

### Skill Seeding

When a project is created, all bundled skills are seeded into the database as DB skills for that project.

- Seeding happens at project creation time, regardless of entry point (CLI or dashboard).
- Each bundled skill becomes a DB skill with `name`, `description`, and `content` from the bundled source.
- If a skill with the same name already exists for the project, it is skipped (no duplicates).

### Skill Installation to Repos

When a repo is registered to a project, all DB skills for that project are installed to the repo.

- For each configured agent, a `SKILL.md` file is written at `<repo>/<agent-skills-dir>/<skill-name>/SKILL.md`.
- Installation happens for every agent configured in the project (e.g. Claude Code at `.claude/skills/`, OpenCode at `.opencode/skills/`).
- Directories are created as needed.

### End-to-End Flow

```
Project created (CLI or dashboard)
  └── Seed bundled skills to DB
        └── For each registered repo:
              └── For each configured agent:
                    └── Write <repo>/<agent-skills-dir>/<skill-name>/SKILL.md
```

---

## Filesystem Layout

After installation, each repo contains one directory per skill per agent:

```
<repo>/
  .claude/skills/
    create-ticket/SKILL.md
    implement-ticket/SKILL.md
    create-proposal/SKILL.md
    ...
  .opencode/skills/
    create-ticket/SKILL.md
    implement-ticket/SKILL.md
    create-proposal/SKILL.md
    ...
```

The agent skills directory is determined by the agent configuration (e.g. `.claude/skills/` for Claude Code).

---

## API

### Skill Endpoints

| Method | Path                                     | Request Body      | Response                   | Status Codes |
| ------ | ---------------------------------------- | ----------------- | -------------------------- | ------------ |
| `GET`  | `/v1/projects/{projectId}/skills`        | —                 | `SkillResponse[]`          | 200          |
| `POST` | `/v1/projects/{projectId}/skills`        | `CreateSkillBody` | `SkillResponse`            | 201, 409     |
| `GET`  | `/v1/projects/{projectId}/skills/{name}` | —                 | `SkillWithContentResponse` | 200, 404     |

### `SkillResponse`

```json
{
  "id": "sk_abc123",
  "project_id": "proj_xyz",
  "name": "create-ticket",
  "description": "Create a new ticket via the CLI.",
  "file_id": "file_def456",
  "created_at": "2026-03-08T10:00:00.000Z",
  "updated_at": "2026-03-08T10:00:00.000Z"
}
```

### `SkillWithContentResponse`

Extends `SkillResponse` with the skill content read from file storage:

```json
{
  "id": "sk_abc123",
  "name": "create-ticket",
  "description": "Create a new ticket via the CLI.",
  "content": "---\nname: create-ticket\n---\n\n# Create Ticket\n..."
}
```

### `CreateSkillBody`

```json
{
  "name": "create-ticket",
  "description": "Create a new ticket via the CLI.",
  "content": "---\nname: create-ticket\n---\n\n# Create Ticket\n..."
}
```

| Field         | Type     | Required | Description                        |
| ------------- | -------- | -------- | ---------------------------------- |
| `name`        | `string` | yes      | Skill name (min 1 character).      |
| `description` | `string` | no       | Short description. Defaults to "". |
| `content`     | `string` | yes      | The SKILL.md content (min 1 char). |

### Implicit Behaviors

- `POST /v1/projects` seeds all bundled skills to the DB for the new project.
- `POST /v1/projects/{id}/repos` installs all DB skills to the registered repo for each configured agent.

---

## Bundled Skills

| Name                   | Description                       |
| ---------------------- | --------------------------------- |
| `create-ticket`        | Create a new ticket via the CLI.  |
| `implement-ticket`     | Implement a ticket end-to-end.    |
| `create-proposal`      | Write a proposal document.        |
| `create-sub-tickets`   | Break a ticket into sub-tickets.  |
| `refine-ticket`        | Refine a ticket with more detail. |
| `update-documentation` | Update project documentation.     |
| `pstdio`               | General pstdio usage guidance.    |

Bundled skills are sourced from the `pstdio-agents` package and shared by both the CLI and the API.

---

## Idempotency

- Seeding the same bundled skill twice for a project does not create duplicates. The second attempt is skipped (409 handled gracefully).
- Installing skills to a repo overwrites existing `SKILL.md` files with the current DB content.

---

## Errors

| Error                            | Cause                                                        |
| -------------------------------- | ------------------------------------------------------------ |
| `"Skill already exists: <name>"` | A skill with this name already exists for the project (409). |
| `"Skill not found: <name>"`      | No skill with this name exists for the project (404).        |
| `"Project not found: <id>"`      | The project does not exist.                                  |
