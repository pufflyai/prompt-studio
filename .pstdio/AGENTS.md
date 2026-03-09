## Updating `.pstdio/docs/`

Documentation is organized by category. Each category has its own rules.

### `specs/` — Behavioral Specifications

- Describe **what the software does**, not how it's implemented.
- Include: signatures, arguments, output examples, and error messages.
- Do **not** include internal implementation details, configuration values, or code references.
- One file per topic. Keep the format consistent across files.

### `architecture/` — Architecture Documentation

- Describe **system design decisions** and how components relate to each other.
- Include: diagrams (ASCII), rules, and the reasoning behind architectural choices.
- One file per topic. Update existing files when the architecture changes.

### `known-issues/` — Known Issues

- Document **known problems** that are not yet resolved.
- One file per issue: what it is, why it exists, the risk, and a potential fix.
- When an issue is resolved, move to `lessons-learned/`.

### `lessons-learned/` — Lessons Learned

- Document **difficult problems or bugs that were eventually figured out**.
- One file per topic: what went wrong, why, and how it was solved.
- Helps future contributors avoid repeating the same mistakes.

### `contributing/` — Contributor Guides

- Describes how to set up and run the project locally.
- Update when prerequisites, dev commands, or project structure change.
- Keep it practical — commands to copy-paste, not prose.

### `navigation.json` — Sidebar Navigation

- Defines the documentation site sidebar structure.
- Update whenever you add, remove, or rename a doc page.
- Follow the existing shape: `{ text, link }` for leaf items, `{ text, items }` for groups.
