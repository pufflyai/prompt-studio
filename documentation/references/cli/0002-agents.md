# Agents

The `pst agents` group lists the agent harnesses that extensions provide and installs Prompt Studio skills for them.

## Commands

```sh
pst agents list
pst agents setup <agent-id> [--global-skills]
pst agents install-skills <agent-id> [--global-skills] [--force]
```

`list` shows each harness's name, qualified ID, and whether its executable is installed. It lists the harnesses installed on this machine. The SDK lists a project's harnesses from that project's enabled extensions instead.

`setup` finds one harness and installs its missing enabled skills. It does not save a default agent. Use `--global-skills` to install skills in the agent's global folder instead of the current project.

`install-skills` installs the enabled skills whose folder is missing from the harness's skill folder. Both commands keep every existing skill folder unchanged, including folders with local edits and same-name skills that Prompt Studio did not write. The output lists the kept skills.

`install-skills --force` replaces the folder of each enabled skill with the current version. This discards local edits in those folders. Folders of skills that are not enabled are never touched. `setup` has no `--force` option.

The enabled extension and project skills are the source, and the agent folders hold copies. To make a lasting change, edit the source skill instead of the installed copy. Prompt Studio also copies skills automatically when it prepares a workspace. That copy updates only files Prompt Studio wrote and that nobody edited since. It keeps same-name files it did not write and files you edited.

Keeping existing skill folders, `--force`, and this automatic-copy behavior arrive in the release after 0.43.x. In 0.43.x, `setup`, `install-skills`, and the automatic copy replace installed skill files with the source, so local edits in them are lost.

Run `pst agents --help` to list the commands and `pst agents <command> --help` for current options.
