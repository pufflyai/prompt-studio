---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# PRD: Templates and skills

## Summary

Extensions own template content. The host supplies storage, packaged-file access, command execution, and a generic settings surface. Skills remain extension assets that Prompt Studio can install into an agent directory.

## Template ownership

An extension can declare template types and the commands that list, read, save, and delete that content. It may ship defaults as package assets. User edits belong to the extension's project storage and override those defaults.

The host does not define template types, seed template rows, choose defaults, or expose template-specific REST and SDK APIs. The dashboard builds its template groups from enabled extension metadata and invokes the declared commands.

The bundled extensions use this model:

| Extension | Types |
| --- | --- |
| `pstdio-planner` | Ticket, prompt, and document templates |
| `pstdio-reports` | Report templates |

Extension commands own workflows that consume templates. For example, Planner applies ticket templates and Reports writes report templates. Use each extension's CLI help to discover those commands.

## Skills

Extensions can ship skills as package assets. Project skills are stored through the host skill service. Together these enabled skills are the source. The folders that agents read, such as `.claude/skills`, `.agents/skills`, and the agents' global folders, hold copies of that source.

Prompt Studio owns a file in an agent skill folder only while it wrote the file and the file still has the content Prompt Studio wrote. It never overwrites or deletes a file it does not own without an explicit request:

- Workspace setup syncs each harness's skill folder. It updates and removes only owned files. It adopts an existing file that already has the wanted content. It keeps a same-name file it did not write and a file the user edited, and writes a warning to the host log. An edited file that leaves the skill set stays in place and is no longer managed.
- `pst agents setup` and `pst agents install-skills` install only skills whose folder is missing. They keep every existing skill folder unchanged and list the kept skills.
- `pst agents install-skills <agent> --force` is the explicit replacement. It replaces each enabled skill's folder with the current source and discards local edits in those folders. It never touches folders of skills that are not enabled.

To make a lasting change, edit the source skill, not the installed copy. To get updates for a kept file again, delete it or run the `--force` install.

## Migration

When an existing database first starts on this architecture, Prompt Studio moves each live legacy template into the owning enabled extension's storage before dropping the old tables. Startup stops with a clear error if ownership cannot be resolved, so content is never discarded silently.

## Delivery record

Checked on 2026-10-18 against main commit `45580feb`. The newest stable release is `pstdio@0.43.1`.

| Field | Record |
| --- | --- |
| Status | Templates: released. Skills: the installation contract above is implemented in source on this branch and is not released. |
| Template implementation | Extension-owned templates and the legacy template migration came in #627 (`packages/pstdio-db/src/db/legacy-template-migration.ts` and `legacy-template-owners.ts`). Since #1158, startup downloads placeholder owner extensions in the background; see [database upgrades](../../references/architecture/0025-database-upgrades.md#legacy-template-owners). |
| Skill implementation | This branch changes the installer in `packages/pstdio/src/features/skills/install-skills.ts`, the `setup` and `install-skills` commands in `packages/pstdio/src/adapters/cli/commands/agents/`, and workspace sync in `packages/pstdio-extensions/src/artifacts/workspace-sync-dir.ts`. Before this change, on `45580feb` and in `pstdio@0.43.1`, the installer deleted and rewrote every enabled skill folder, and workspace sync overwrote every wanted file, including edited ones. |
| Availability | #627 shipped in `pstdio@0.30.0`. #1158 is in the nightly `pstdio@0.44.0-nightly.20261018030230` only. The skill contract is in no release. |
| Remaining work | Merge and release the skill contract, then check real agent folders from the packaged CLI for first install, reinstall, edited content, and `--force`. Move legacy template imports into Planner and Reports with the extension migration helpers; that work is open in #1173 and waits for an SDK release with #1168. |
| Evidence | Unit tests, passed locally on 2026-10-18: `legacy-template-migration.test.ts` (unknown types, normalized-name collisions, ambiguous owners) and `packages/pstdio-api/src/startup/index.test.ts` (background preparation and owner repair). Skill tests, passed locally on 2026-10-18 against this branch's uncommitted source: `install-skills.test.ts` and `agents/setup.test.ts` in `packages/pstdio` (12 tests), and `workspace-files-mount.test.ts` in `packages/pstdio-extensions` (15 tests). No packaged run is recorded. |
