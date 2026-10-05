# Agents

The `pst agents` group lists the agent harnesses that extensions provide and installs Prompt Studio skills for them.

## Commands

```sh
pst agents list
pst agents setup <agent-id> [--global-skills]
pst agents install-skills <agent-id> [--global-skills]
```

`list` shows each harness's name, qualified ID, and whether its executable is installed. It lists the harnesses installed on this machine. The SDK lists a project's harnesses from that project's enabled extensions instead.

`setup` finds one harness and installs its enabled skills. It does not save a default agent. Use `--global-skills` to install skills in the agent's global folder instead of the current project.

`install-skills` installs any enabled skills that the selected harness is missing. Prompt Studio does not overwrite an existing skill with the same name.

Run `pst agents --help` to list the commands and `pst agents <command> --help` for current options.
