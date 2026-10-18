# Scope and source location

Decide two things before you create files: where the source lives, and which scope the manifest declares. The public contract is [Installing and updating](https://prompt.studio/docs/references/extensions/manifest-and-installation/#installing-and-updating).

## Source and installed copies

The source folder is the one you edit and keep in version control. An installed copy is what the host runs. Treat installed copies as disposable output.

| Location | What it is | Edit it? |
| --- | --- | --- |
| Your extension folder, such as `~/code/bookmarks/` | Reusable source | Yes |
| `<project>/.pstdio/extensions/<name>/` for a repo-scoped extension | Source that belongs to that repository | Yes, when the repository owns the extension |
| `$PSTDIO_HOME/extensions/<install-name>/` (default `~/.pstdio/extensions/`) | The host's installed copy of a user-scoped extension | No |
| Agent skill folders, such as `.agents/skills/<skill>/` or `.claude/skills/<skill>/` | Installed copies of skills | No |

`pst extensions add <path> --force` replaces an installed copy for every project that uses it. Edits made only in an installed copy are lost and are not in your source. When a user asks you to change an installed extension, find its source first. The extension detail view in the dashboard shows the source folder of each installed extension. If no source exists, copy the installed folder to a new source folder and work there.

## User or repo scope

Set the scope in `package.json`:

- Omit `pstdio.scope`, or set `"pstdio": { "scope": "user" }`, for a tool the user wants across projects. The host installs it under its `$PSTDIO_HOME/extensions/<install-name>/`. Installing turns it on for the current project; other projects list it as turned off until someone turns it on there.
- Set `"pstdio": { "scope": "repo" }` for behavior that belongs to one repository, such as worktree setup, status checks that run the repository's scripts, or hooks that read repository files. The host installs it under `<project>/.pstdio/extensions/<install-name>/`. Repo extensions are found and turned on when the project opens, and their code runs at that point.

Prefer repo scope when the request mentions hooks, repository checks, worktree setup, or commands such as `bun test`, unless the user asks for a personal tool. If the user has the same extension in both scopes, a project runs only one copy per extension ID. The user picks the copy in the extension panel.

In the Prompt Studio repository itself, first-party extensions live in `extensions/<name>/`.

## Install from the linked project

Every install and development command needs a linked project: a folder with `.pstdio/config.json`. Run them from that folder and pass the extension source as an absolute path:

```sh
cd /path/to/linked-project
pst extensions add /path/to/bookmarks --force
pst extensions dev /path/to/bookmarks
```

An absolute source path from the linked project works on every release. From the release after 0.43.x, `.`, `..`, `./x`, `../x`, `~/x`, and absolute paths are all local folders, and `pst extensions add .` works from any folder inside a linked project. On 0.43.1 and older, a bare `.` is read as a catalog name. Outside a linked project, newer releases print the exact command to run instead.

`add` uploads the source to the host, which installs dependencies, checks the extension, and turns it on for the project. Without `--force`, an existing install is refused. `dev` watches the source and refreshes the project on each save. Use `dev` while you work and `add --force` for a final install test.

## A variant for one project

The installed source is shared by every project that uses it. If one project needs a different version, copy the source folder, change `name` in `package.json` so the extension ID differs, and install that copy.
