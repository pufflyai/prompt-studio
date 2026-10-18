# Extension validation

Run the smallest checks that prove what you changed. Each check below proves one thing; none proves everything. The public guides are [Write an extension](https://prompt.studio/docs/guides/extensions/authoring/) and [Smoke checks](https://prompt.studio/docs/guides/extensions/smoke-checks/).

## Test behavior first

For a behavior change, write the smallest test that shows the missing behavior, confirm it fails for the expected reason, then make it pass. Put the test next to the file it covers. Skip tests for documentation-only, configuration-only, and wording-only changes. Check UI changes by using the UI.

## Choose checks by change

| What changed | Check |
| --- | --- |
| Command logic or data rules | The focused test file, then a typecheck |
| `package.json`, IDs, contributions, or references | `pst extensions check <source>` |
| Anything the host installs or runs | Install with `pst extensions add <absolute-source> --force`, then `pst extensions check` |
| Pages and views that open without a resource | `pst extensions test <absolute-source>` |
| A command people and agents call | `pst <name> <command> --help`, then one real call with `--json` |
| Resource pages, forms, and interactions | Use them in the dashboard; see [manual review](#review-a-resource-tool-manually) |
| Project data | Add data in one linked project and list it in a second one; see [project separation](extension-api.md#each-project-has-its-own-data) |

Do not run a whole repository or monorepo suite for an extension change unless the user asks for it or the project's contributor rules require it. Report each command you ran and its result.

## Run tests and typecheck with the bundled Bun

The installed `pst` executable contains Bun. Do not assume `bun`, `bunx`, or Node.js is installed separately. In a POSIX shell:

```bash
BUN_BE_BUN=1 pst test <path-to-test>
BUN_BE_BUN=1 pst --cwd <path-to-extension> ./node_modules/typescript/bin/tsc --noEmit
```

In PowerShell, set `$env:BUN_BE_BUN = "1"`, run the same commands without the prefix, and remove it with `Remove-Item Env:BUN_BE_BUN` before running normal `pst` commands.

Run the TypeScript command only when the extension has TypeScript installed and a `tsconfig.json`. Keep any extra compiler options from its `typecheck` script. A typecheck proves imports and declarations, not layout or host behavior.

## Source checks and installed checks

`pst extensions check` has two modes. They check different things.

| Mode | Command | What it checks | Needs |
| --- | --- | --- | --- |
| Source check | `pst extensions check <source> --json` | One source folder, against the extension API and dashboard capabilities bundled in the CLI you ran | Nothing; it does not start the host or install files |
| Installed check | `pst extensions check [--scope repo\|user] --json` | What the running host has installed, in its user root, its repo root, or both | A linked project and a reachable host |

A source check can pass while the host rejects the extension, when `pst` and the host are different releases. Compare `pst --version` with the app version in **Help** at the bottom of the dashboard sidebar.

### JSON results

Both modes print one JSON object:

| Key | Source check | Installed check |
| --- | --- | --- |
| `target` | `{ kind: "source", path }` | `{ kind: "installed", projectId, host }` |
| `versions` | `cli`, `extensionApi`, `sdk`, and `manifestRange` (your `engines.pstdio`) | `cli`, `extensionApi`, `sdk` |
| Results | `check`: one result | `checks`: one result per host root, each with `scope` (`user` or `repo`) |

`versions` always describes the `pst` you ran, never the host. A source check compares `manifestRange` with `versions.extensionApi`. An installed check is done by the host with its own API version.

Each result has `errorCount`, `warningCount`, and `hostCompatibility` (with `status` `verified` or `unverified`, and its own `diagnostics`). Other diagnostics are in `runtime.diagnostics` for a source check and in `diagnostics` for each installed result. Each diagnostic has a `code`, a `severity`, a `message`, and often the extension ID, source path, and `metadata`. `unverified` means no host description was available, so dashboard support was not proven. Older releases print a different shape, such as no `target` key; read the keys you get.

Save large output to a file with `>` instead of piping it, then parse the file. The command exits with an error when any result has errors.

Treat warnings as work to review. Diagnostics name the extension, the contribution, and the field. Fix the named field first. Common codes:

- `extension_manifest_unsupported_api_version`: `engines.pstdio` does not include the host's API version. The message names both versions.
- `extension_host_capability_missing`: the dashboard does not support a declared surface. Metadata names the missing capability and the host version.
- `extension_contribution_id_invalid`: a local ID is not lowercase kebab-case segments joined by dots.
- `extension_command_reference_missing`: a contribution names a command that does not exist.
- `extension_icon_unknown`: an icon name is not in the host icon set.

## Development loop

From the linked project, start the watcher with an absolute source path:

```bash
pst extensions dev /path/to/extension
```

The first cycle checks the extension, publishes it to the project, and lists its contributions and webviews. Each save refreshes it. Changes to `package.json` or the lockfile reinstall dependencies first. Errors stay in the terminal; the last valid version keeps running. Stop with Ctrl+C.

A successful refresh does not prove that an open webview loaded it. Reopen the view and check the visible result. If the host still serves old content, report the contribution ID and host version as a platform bug. Do not add cache-busting code to the extension.

## Isolated smoke test

```bash
pst extensions install-browser
pst extensions test /path/to/extension
pst extensions test /path/to/extension --json
```

The test copies the source into a fresh, private Prompt Studio, installs it, checks it, and opens pages that need no resource in a real browser. Exit codes: 0 pass, 1 extension runtime failure, 2 install or declaration error, 3 input or setup failure. It does not run arbitrary commands, create resources, or click through interactions. Read the list of contributions it did not exercise even when it passes. Older CLIs may not have this command; check `pst extensions --help`.

`--project-path <folder>` uses a folder that contains the source and its local dependencies. `--keep-home` keeps the private home, project, and logs for inspection. On Linux, `pst extensions install-browser --with-deps` installs missing system libraries.

## Install test

After the development loop, install the source as a user would:

```bash
cd /path/to/linked-project
pst extensions add /path/to/extension --force
pst extensions check
```

Do not pass `--skip-install`. The install must create the extension's own dependencies on the host. Run `pst <name> --help` and one real command afterwards.

## Review a resource tool manually

Resource pages need real resources; the smoke test does not open them. For the [resource reviewer](examples.md#resource-reviewer):

- Select both catalog items in the tree, and open one from command-palette search. Both routes reach the same page.
- Edit the heading and details, then Apply. The preview changes. Reset from the preview; the inspector updates too.
- Switch resources while a read is running and after saving. Each resource shows its own settings.
- Leave the page and come back. Saved settings remain.
- Resize Main and its attached menus. The preview stays inside Main, the toolbar stays reachable, and scrolling stays inside the content. Check light and dark themes.

## Changed packaged files

When shipped files change, such as skills, templates, prompts, or themes, reinstall with `pst extensions add <absolute-source> --force` and run `pst extensions check` again.

## If a check cannot run

Record the exact command, the error, and why it could not run. Do not report the change as validated.
