---
status: draft
---

# Documentation

Browse and read project documentation in the dashboard. Documentation entries are markdown files stored under `.pstdio/docs/`.

---

## Frontmatter

Documentation entries can include a YAML frontmatter block at the top of the file, delimited by `---`. Frontmatter values are metadata about the document — they are not rendered inline with the markdown body.

### Format

```markdown
---
status: draft
owner: alice
priority: high
---

# My Document

Body content starts here.
```

- The frontmatter block must be the very first thing in the file.
- It uses standard YAML key-value syntax.
- Keys and values are free-form — there is no fixed schema. Teams define their own conventions.
- The frontmatter is stripped from the rendered markdown body.

---

## Properties Panel

Frontmatter values are displayed in a **properties panel** on the right side of the documentation page, next to the document body.

### Layout

```
+------------------+------------------------------+-----------------+
| Sidebar          | Document Body                | Properties      |
| (navigation)     |                              |                 |
|                  | # My Document                | status: draft   |
|                  |                              | owner: alice    |
|                  | Body content starts here.    | priority: high  |
|                  |                              |                 |
+------------------+------------------------------+-----------------+
```

- The properties panel is visible when the document has frontmatter.
- When there is no frontmatter, the properties panel is hidden and the document body takes the full width.
- Each frontmatter key-value pair is displayed as a labeled property row.

### Behavior

- Properties are displayed in the same order as they appear in the frontmatter.
- Keys are displayed as labels. Values are displayed as plain text.
- The properties panel is read-only in the dashboard.

---

## Data Flow

1. The API returns the full markdown content including frontmatter via `GET /v1/projects/:id/docs/content?link=<link>`.
2. The client splits the frontmatter from the body using `splitFrontmatter()`.
3. The body is rendered in the markdown viewer.
4. The frontmatter is parsed into key-value pairs and rendered in the properties panel.
