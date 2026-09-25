# Projects and workspaces

A project owns tools, settings, and saved data. A workspace identifies where work happens. A session runs in a workspace.

A project has one default workspace. That relationship owns the project's home location. Projects do not store another path or link a list of repositories. Workspace records store a local `root_path` or a remote provider reference.

## Open a folder

Choose or create one folder to open a local project. The host resolves symlinks and opens an existing project for the same canonical folder. A child folder is a distinct project selection, even inside a Git repository. The folder name supplies the initial project name, including numeric and Unicode names. Project settings can rename it.

`POST /v1/projects` takes an optional name and one `initial_workspace` with `provider_id` and `params`. Local onboarding uses `pstdio.root` and `{ "path": "/chosen/folder" }`. The server owns default extension setup, config files, and workspace provisioning. Missing agents do not block opening a project. Failed setup stays unavailable and reopening the same folder retries the same project and workspace.

`POST /v1/projects/{id}/retry-setup` retries setup for an existing local or remote project. It returns the default workspace, including any remaining `setup_error` or provider failure. Retries keep the project, workspace, provider reference, and pending provider operation. A remote resource that already exists is resolved, not created again.

The folder picker starts at the host's home directory. It supports hidden folders, a typed path, parent navigation, selecting the current folder, and creating one child folder. Cancelling the picker leaves a newly created folder in place.

## Workspace targets

The default folder workspace supports files. Sessions reuse it and share its files. It does not provide diff, merge, rebase, or isolation. Choosing a root sets the file browser root and working directory; it does not sandbox an agent process.

Providers declare their parameters and capabilities. `pstdio.worktree` creates an isolated Git branch when the selected folder belongs to a repository with a usable base commit. For a Git subfolder, the provider creates a repository worktree and uses the matching subfolder as `root_path`. A missing subfolder at the chosen revision fails and cleans up that worktree. Files remain scoped to the folder; Git review and merge cover every affected repository path.

Remote providers own their source and environment. They keep provider references rather than local paths. A remote target never falls back to the project folder. Creating one does not upload or synchronize local files.

`GET /v1/projects/{id}/workspace-providers` lists providers that can create additional workspaces. The already-open project workspace is listed separately. Plain folders have no creation choices unless an extension supplies a provider. Git creation appears only with a usable commit; cloud providers do not require a local folder or Git source.

`POST /v1/workspaces` accepts `project_id`, `provider_id`, provider `params`, and optional resource `anchors` and `shorthand_base`. Anchors keep the requesting tool's resource links. A shorthand base such as `DOC-7` produces `DOC-7_A1`; without it, the workspace uses the project's next `WS-N` name. Both forms retain anchors.

Extension `projectFiles` reads the default workspace. `workspaceFiles` reads the selected workspace. Sessions, terminals, file mounts, extension discovery, and provisioning resolve workspace targets. Planner's commit-based implementation and review actions require Git; other tools remain available in plain folders.

## Location discovery and deletion

The CLI finds the nearest ancestor `.pstdio/config.json`, without asking Git for a root. Config identifies a project and workspace; it is not the authority for the project's home. Old config links in discarded folders cannot replace the default workspace.

Folder initialization claims this config before provisioning. Another host's binding is preserved and setup fails with a clear error. Retries accept the same identity. A known obsolete link can be replaced only when it does not belong to a live workspace at that folder.

Host metadata must stay inside the workspace folder. Setup rejects symlinks at `.pstdio`, `config.json`, and its `.gitignore` before writing metadata. Deletion preserves linked metadata. A selected folder alias is still resolved to its canonical folder during onboarding.

Deleting a project or workspace preserves user-selected folders and user files. Providers can remove only the resources they created. Project deletion removes its saved host data and its own matching CLI config binding, so the folder can be opened again. Foreign and malformed config files are preserved.

## Alpha upgrade

The schema upgrade preserves project and workspace IDs and history. It preserves a recorded default workspace folder first, otherwise the earliest linked folder by link creation time and link ID. Other existing workspaces keep their own locations and Git provider references. Remote references stay remote. A project without a recoverable location retains its data and can attach an initial workspace from settings. The upgrade materializes locations before dropping repository tables.
