# Projects

A project is a folder that Prompt Studio opens with its own tools, settings, data, and workspaces. These commands create, list, inspect, and remove projects.

```sh
pst projects create [name] [--path <folder>]
pst projects list
pst projects view [--project-id <project-id>]
pst projects delete <project-id>
pst projects environment          # from the release after 0.43.x
pst projects bind <project-id> --environment <environment-id> --name <name> --path <folder>   # from the release after 0.43.x
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
