# CLI projects

A project owns tools, settings, saved data, and workspaces. Open one existing folder with:

```sh
pst projects create [name] [--path <folder>]
pst projects list
pst projects view [--project-id <project-id>]
pst projects delete <project-id>
```

`create` defaults to the exact current directory and its folder name. Git is optional. Numeric and Unicode folder names work. Selecting the same canonical folder again opens its existing project. Selecting a child creates a distinct project, including inside a Git repository.

```sh
pst projects create --path ./notes
pst projects create "My tools" --path ./tools
```

The server writes `.pstdio/config.json`, initializes extensions, and provisions the default workspace. Additional sessions share this folder. Project settings can rename the project.

Commands discover the nearest ancestor `.pstdio/config.json`. They do not move to a containing Git root. The default workspace remains the authority for project files, including when an old config file exists elsewhere.

`delete` removes the project from active use while preserving the selected folder and its contents. Provider-created resources follow their provider's deletion rules.

Run `pst projects <command> --help` for current options.
