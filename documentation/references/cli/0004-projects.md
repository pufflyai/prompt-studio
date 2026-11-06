# Projects

A project is a folder that Prompt Studio opens with its own tools, settings, data, and workspaces. These commands create, list, inspect, and remove projects.

```sh
pst projects create [name] [--path <folder>]
pst projects list
pst projects view [--project-id <project-id>]
pst projects delete <project-id>
pst projects environment          # from the release after 0.43.x
pst projects bind <project-id> --environment <environment-id> --name <name> --path <folder>   # from the release after 0.43.x
pst projects recovery-points <project-id>   # on main
pst projects restore <project-id> --hours <1|12|24> --captured-at <time> [--extension-id <extension-id>]   # on main
pst projects folder sources <project-id>   # unreleased
pst projects folder status <project-id>    # unreleased
pst projects folder capture <project-id>   # unreleased
pst projects folder download <project-id> --device <device-id> --source <source-id> [--no-wait]   # unreleased
pst projects folder restore <project-id> --device <device-id> --source <source-id> --path <new-folder> [--no-wait]   # unreleased
pst projects folder cancel <project-id>    # unreleased
```

`create` uses the current directory and its folder name unless you pass `--path` or a name. Git is optional. Numeric and Unicode folder names work. Choosing the same folder again, including through a symlink, opens its existing project. Choosing a child folder creates a separate project, even inside a Git repository.

```sh
pst projects create --path ./notes
pst projects create "My tools" --path ./tools
```

The runtime writes `.pstdio/config.json` in the folder, sets up the default extensions, and creates the default workspace. Sessions in that workspace share the folder. You can rename the project in its settings.

Commands find the project from the nearest `.pstdio/config.json` in the current folder or a parent folder. They do not move up to a containing Git root. The project's default workspace decides where its files are, even when an old config file exists elsewhere. A folder with this file is a linked project. Commands that act on a project, such as `pst extensions add` and `pst workspaces`, need one.

`delete` removes the project from Prompt Studio. The folder and its contents stay on disk. Resources that a workspace provider created follow that provider's deletion rules.

Run `pst projects <command> --help` for current options.

`environment` and `bind` are on `main` and ship in the release after 0.43.x. The 0.43.x CLI does not have them.

`environment` prints this runtime's stable environment ID as JSON. `bind` associates a known workbench (project) ID with an existing folder in that environment. Pass the ID returned by `environment` to select the target explicitly. The command preserves existing bindings and prints the resulting local workspace as JSON. It does not grant cloud access or start synchronization. Existing local projects stay independent.

`recovery-points` and `restore` are on `main` and first ship in 0.46.0. `recovery-points` prints this device's recovery points for a cloud project as JSON, with each point's period, capture time and restorable extensions. `restore` writes the difference to one of those points as a normal edit, so it syncs to your other devices. Pass the exact `capturedAt` from the list. See [Restore project data](../../guides/concepts/0006-restore-project-data.md).

`projects folder` is unreleased and works on macOS and Linux. It recovers a cloud project's folder from a copy that one of your devices captured, without a Git host or the source device online. Each device that has the folder captures it under the root `.pstignore` and uploads an encrypted copy; your other devices download every completed copy automatically.

- `sources` prints the copies as JSON: device, source, original folder, capture times, included files and bytes, the applied `.pstignore`, Git state, and whether every byte is already on this device (`available`).
- `restore` creates the new folder. The path must not exist, not even as an empty folder, and its parent must exist. The copy is downloaded first if needed, written into a hidden sibling staging folder, verified and then moved into place with a rename that refuses an existing folder. If something creates the folder meanwhile, the restore fails and that folder stays unchanged. The restored folder becomes the project's folder through the normal attach flow, unless the project already has a folder on this device. A relative `--path` is resolved from your current folder. Restored hooks, scripts and automations are not run, and the folder's own extensions stay disabled until you enable them. Working Git administration that lived outside the source folder is rebuilt under `.pstdio/recovery/`, which Git ignores. Git links to administration that was not restored are left out, so the restored folder never changes another repository on this computer. Restored files keep permission bits only.
- `download` and `restore` wait and print progress to stderr, then print the same JSON as `status` and the project's sync status. A failed or cancelled operation exits with status 1 and prints its error code and message. Ctrl-C cancels it and removes only its staging folder. Pass `--no-wait` to return immediately.
- `capture` captures this device's folder now. `cancel` stops a running download or restore.

The device must have connected to Cloud once since Prompt Studio started, so it can unlock its private copies.
