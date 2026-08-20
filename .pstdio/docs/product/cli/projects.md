---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI projects

A project groups repositories, documentation, sessions, workspaces, templates, and extension data.

## Commands

```sh
pst projects create [name] [--repo <path>...]
pst projects link --project-id <project-id>
pst projects unlink
pst projects list
pst projects view [--project-id <project-id>]
pst projects repos [--project-id <project-id>]
pst projects delete <project-id>
```

## Create a project

`create` initializes `.pstdio/config.json` in the current directory. The project name defaults to the current folder name. Repeat `--repo` to connect more than one Git repository. When `--repo` is absent, Prompt Studio connects the current repository when possible.

```sh
pst projects create prompt-studio --repo . --repo ../shared-tools
```

## Link or unlink a repository

`link` connects the current Git repository to an existing project. `unlink` removes the local project link. It does not delete the project.

```sh
pst projects list
pst projects link --project-id <project-id>
pst projects unlink
```

## Inspect a project

`view` prints project details. `repos` lists the repositories connected to the project. Both commands use the project in `.pstdio/config.json` unless `--project-id` is provided.

## Delete a project

`delete` removes the project from active use. It does not remove local `.pstdio` files, so unlink the repository separately when needed.

Run `pst projects <command> --help` for current options.
