---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI agents

The `pst agents` group discovers extension-provided harnesses and installs Prompt Studio skills.

## Commands

```sh
pst agents list
pst agents setup <agent-id> [--global-skills]
pst agents install-skills <agent-id> [--global-skills]
```

`list` shows the harness name, qualified ID, and whether its executable is installed. This command lists the host-wide installed harness registry. Project-scoped SDK discovery instead uses that project's enabled catalog. Neither reads a core agent configuration table.

`setup` resolves one harness and installs its enabled skills. It does not persist a default agent configuration. Use `--global-skills` to install skills in the agent's global directory instead of the current project.

`install-skills` installs any missing enabled skills for the selected harness. Prompt Studio does not overwrite an existing skill with the same name.

Run `pst agents --help` to list the commands and `pst agents <command> --help` for current options.
