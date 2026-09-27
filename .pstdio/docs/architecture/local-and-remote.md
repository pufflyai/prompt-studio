# Local and remote workspaces

Projects are not classified as local or remote. A project owns settings, extensions, and saved data. Its workspaces can use different providers and execution targets.

The default workspace supplies project files and the home location. A local default uses the exact chosen folder. A remote default uses a provider reference. Providers supply remote files or source; Prompt Studio does not infer a Git source or synchronize a local folder.

| Workspace | Location | Execution | File ownership |
| --- | --- | --- | --- |
| Project folder | Canonical `root_path` | Local process | User-owned folder; shared by sessions |
| Git worktree | Subfolder within a provider-created worktree | Local process | Git provider owns the worktree and branch |
| Remote environment | Provider reference | Remote target | Provider owns lifecycle and file access |

Every session resolves its selected workspace target. A remote workspace cannot use a local directory as a fallback. The host routes files, terminals, and operations through provider capabilities. A provider without a capability does not advertise the corresponding action.

The API and database can run locally or on a host. Their deployment does not determine workspace execution. A directory path is interpreted on the host that owns the local workspace.

See [Projects and workspaces](projects.md) for onboarding, provisioning, and upgrade rules.
