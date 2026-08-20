---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI agents

The `pst agents` group configures coding agents and installs Prompt Studio skills.

## Commands

```sh
pst agents list
pst agents setup <agent-id> [--global-skills]
pst agents install-skills <agent-id> [--global-skills]
```

`list` shows which supported agents are installed, configured, and selected as the default.

`setup` configures one agent and installs its enabled skills. The first configured agent becomes the default. Use `--global-skills` to install skills in the agent's global directory instead of the current project.

`install-skills` installs any missing enabled skills without changing the agent configuration. Prompt Studio does not overwrite an existing skill with the same name.

Run `pst agents --help` to list the commands and `pst agents <command> --help` for current options.
