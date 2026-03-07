# Customizable Templates

## Purpose

Allow users to customize the templates that pstdio uses to generate tickets, prompts, and skills. Projects ship with sensible bundled defaults, but users can override, extend, or replace them to match their team's workflow.

---

## Overview

pstdio uses three kinds of templates:

1. **Ticket templates** — markdown files with placeholder tokens, used when creating tickets (`pstdio tickets write`).
2. **Prompt templates** — text files with Jinja-style variables, used by agents for structured LLM interactions (e.g. commit messages, squash messages).
3. **Skills** — markdown instruction files installed into agent config directories, used to teach agents project-specific workflows.

Each kind has bundled defaults that ship with pstdio. Users can customize them at two levels: **project-level** (shared with the team via `.pstdio/`) and **global-level** (personal, stored in `~/.pstdio/`).

```
Precedence (highest to lowest):

  project override  →  global override  →  bundled default
```

---

## Concepts

| Term               | Definition                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| Bundled template   | A default template shipped inside the pstdio package. Read-only at runtime.                    |
| Project override   | A user-created template stored in `.pstdio/` that replaces a bundled template for one project. |
| Global override    | A user-created template stored in `~/.pstdio/` that replaces a bundled template everywhere.    |
| Template type      | The category a template belongs to: `ticket`, `prompt`, or `skill`.                            |
| Placeholder token  | A `{{TOKEN}}` string in a ticket template, replaced at write time.                             |
| Template variable  | A `{{ variable }}` in a prompt template, replaced at render time using Jinja-style syntax.     |

---

## Behavior

### Resolution Order

When pstdio needs a template, it resolves it in this order:

1. **Project override** — `.pstdio/templates/<name>` (ticket/prompt) or `.pstdio/skills/<name>/` (skill)
2. **Global override** — `~/.pstdio/templates/<name>` or `~/.pstdio/skills/<name>/`
3. **Bundled default** — shipped inside the pstdio package

The first match wins. This applies to all three template types.

### Initialization

When a project is created (`pstdio projects create`), bundled templates are seeded into the project's database as the starting set. Users can then modify them via the CLI or by editing files directly.

---

## 1. Ticket Templates

Ticket templates are markdown files with YAML frontmatter and `{{PLACEHOLDER}}` tokens.

### Bundled Defaults

| Name        | Default | Description                                          |
| ----------- | ------- | ---------------------------------------------------- |
| `ticket`    | yes     | Standard ticket with scope, steps, and acceptance.   |
| `proposal`  | no      | Proposal with goals, scenarios, and implementation.  |

### Storage

| Level   | Path                                          |
| ------- | --------------------------------------------- |
| Project | `.pstdio/templates/<name>.md`                 |
| DB      | `POST /v1/projects/:id/templates` (ticket type) |

### Customization

Users customize ticket templates via the CLI:

```sh
# Create a custom ticket template
pstdio templates create --name bugfix --type ticket --file ./my-bugfix-template.md

# Set it as the default for new tickets
pstdio templates update --name bugfix --default

# Use it when writing a ticket
pstdio tickets write --title "Fix login" --template bugfix
```

### Placeholder Tokens

| Placeholder        | Replaced With                          |
| ------------------ | -------------------------------------- |
| `{{TICKET_ID}}`    | Ticket shorthand (e.g. `PS-12`)        |
| `{{TICKET_TITLE}}` | Ticket title                           |
| `{{CREATED_AT}}`   | ISO 8601 timestamp                     |
| `{{USER_PROMPT}}`  | Original user prompt, or empty string  |
| `{{STATUS}}`       | Initial ticket status                  |
| `{{INPUT}}`        | Raw input text                         |
| `{{PARENT_ID}}`    | Parent ticket shorthand, or empty      |

---

## 2. Prompt Templates

Prompt templates are text files using Jinja-style `{{ variable }}` syntax. They are used to construct LLM prompts for automated tasks.

### Bundled Defaults

| Name              | Description                                       |
| ----------------- | ------------------------------------------------- |
| `commit-message`  | Generate a one-line commit message from a diff.   |
| `squash-message`  | Combine multiple commits into one message.        |

### Storage

| Level   | Path                                    |
| ------- | --------------------------------------- |
| Project | `.pstdio/prompts/<name>.txt`            |
| Global  | `~/.pstdio/prompts/<name>.txt`          |
| Bundled | `packages/pstdio/files/prompts/<name>.txt` |

### Customization

Users override a prompt template by placing a file with the same name in the project or global directory:

```sh
# Override the commit message prompt for this project
cat > .pstdio/prompts/commit-message.txt << 'EOF'
Write a conventional commit message for this diff.
Use the format: <type>(<scope>): <description>

Branch: {{ branch }}
Diff:
{{ git_diff }}
EOF
```

### Template Variables

Variables available depend on the prompt context:

| Variable              | Available In                    | Description                        |
| --------------------- | ------------------------------- | ---------------------------------- |
| `{{ branch }}`        | `commit-message`                | Current git branch name            |
| `{{ git_diff }}`      | `commit-message`, `squash-message` | The diff to summarize           |
| `{{ commits }}`       | `squash-message`                | List of commit messages to combine |

---

## 3. Skills

Skills are markdown instruction files that teach agents how to perform project-specific workflows. Each skill is a directory containing a `SKILL.md` and optional `references/`.

### Bundled Defaults

| Name                   | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| `create-ticket`        | Create a new ticket via the CLI.                     |
| `implement-ticket`     | Implement a ticket end-to-end.                       |
| `create-proposal`      | Write a proposal document.                           |
| `create-sub-tickets`   | Break a ticket into sub-tickets.                     |
| `refine-ticket`        | Refine an existing ticket with more detail.          |
| `review-ticket`        | Review a ticket for completeness.                    |
| `update-documentation` | Update project documentation.                        |
| `pstdio`               | General pstdio usage guidance.                       |

### Storage

| Level   | Path                                                     |
| ------- | -------------------------------------------------------- |
| Project | `<agent-skills-dir>/<skill-name>/SKILL.md`               |
| Global  | `<agent-global-skills-dir>/<skill-name>/SKILL.md`        |
| Bundled | `packages/pstdio/files/skills/<skill-name>/SKILL.md`     |

The exact agent skills directory depends on the configured agent (e.g. `.claude/skills/` for Claude Code).

### Customization

Skills are installed as regular files in the agent's skills directory. Users customize them by editing the installed files directly:

```sh
# Skills are installed during project setup
pstdio agents install-skills claude-code

# Edit an installed skill
$EDITOR .claude/skills/create-ticket/SKILL.md

# Install skills globally (personal, not shared)
pstdio agents install-skills claude-code --global-skills
```

Since skills are plain files copied into the agent's directory, any edits persist. Re-running `install-skills` only installs missing skills — it does not overwrite existing ones.

### Skill Structure

```
<skill-name>/
  SKILL.md          # Main instruction file (with YAML frontmatter)
  references/       # Optional supporting documents
    topic-a.md
    topic-b.md
```

SKILL.md frontmatter:

```yaml
---
name: create-ticket
description: "Short description of when this skill should be triggered."
---
```

---

## Rules & Constraints

- Project overrides take precedence over global overrides, which take precedence over bundled defaults.
- Bundled defaults are never modified at runtime — they are read-only reference copies.
- `install-skills` skips skills that already exist in the target directory, preserving user edits.
- Ticket templates are stored in the database and managed via the `pstdio templates` CLI.
- Prompt templates and skills are file-based — no database storage, just filesystem resolution.
- Template names must be unique within their type and project scope.

---

## Errors

| Error                                        | Cause                                                        |
| -------------------------------------------- | ------------------------------------------------------------ |
| `"Template not found: <name>"`               | No template with this name exists at any resolution level.   |
| `"Template already exists: <name>"`          | Attempting to create a template with a duplicate name.       |
| `"Invalid type: <type>"`                     | Template type is not `ticket`, `prompt`, or `skill`.         |
