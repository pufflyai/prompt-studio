# Maintaining skills

This guide is for Prompt Studio contributors who change the skills that ship with core extensions. A skill is a folder with a `SKILL.md` file and optional support files. Agents read it after Prompt Studio copies it into their skill folder, usually without a Prompt Studio checkout.

## Ownership

A skill belongs to the extension that declares it. That extension's maintainers review its changes, and its changeset names that extension.

| Skills | Owner | Source folder |
| --- | --- | --- |
| `pstdio`, `create-pstdio-extension` | `pstdio-skills` | `extensions/pstdio-skills/skills/` |
| `create-ticket`, `refine-ticket`, `create-proposal`, `create-sub-tickets`, `implement-ticket` | `pstdio-planner` | `extensions/pstdio-planner/skills/` |
| `use-reports` | `pstdio-reports` | `extensions/pstdio-reports/skills/` |
| `publish-artifact` | `pstdio-artifacts` | `extensions/pstdio-artifacts/skills/` |

Repo-scoped extensions in `.pstdio/extensions/<name>/`, such as Shape Art, own their own skills. They are not shipped to users.

## How skills ship

An extension declares each skill in `extension.ts`:

```ts
defineSkill({
  id: "create-pstdio-extension",
  title: "Create a pstdio extension",
  source: packageAsset("./skills/create-pstdio-extension", import.meta.url),
});
```

The host reads the folder from the installed extension and offers it as a project skill. `pst agents setup` and `pst agents install-skills` copy it into an agent's skill folder, such as `.agents/skills/` or `.claude/skills/`. Workspace setup keeps those copies in sync. The rules for installed copies are in [templates and skills](../../requirements/platform/0004-templates-and-skills.md#skills):

- Installed folders are derived copies. The extension's skill folder is the only source.
- `setup` and `install-skills` install missing skill folders and keep existing ones unchanged.
- `install-skills --force` replaces the folder of each enabled skill and discards local edits.
- Automatic sync updates only files Prompt Studio wrote that are still unchanged. It keeps edited files and same-name files it did not write.

Never edit an installed copy to change a shipped skill, including copies in this repository's own agent folders. Edit the source folder above.

Core extensions are bundled with the CLI. Two tests list the shipped files of `create-pstdio-extension`: [the core catalog test](../../../packages/pstdio-api/src/features/extensions/core-extension-catalog.p1.test.ts) and [the packaged smoke check](../../../packages/e2e/src/packaged/packaged-core-extensions-smoke.p1.test.ts). When you add, rename, or remove a file in that skill, update both.

The TypeScript examples in `create-pstdio-extension/references/examples/` compile as part of the `pstdio-skills` typecheck. They use the `@pstdio/sdk` and `@pstdio/ui` releases in that extension's lockfile, not the workspace source.

## Links

An exported skill folder must work on its own. Follow these rules in every file of a shipped skill:

- Link files inside the skill folder with relative paths, such as `references/validation.md` or `examples/commands.ts`. Never link outside the folder with `../`. Every linked file must be in the folder.
- Link central documentation with public website URLs, such as `https://prompt.studio/docs/references/cli/sessions/#create-a-session`. A repository-relative link to `documentation/` breaks after export.
- Only link pages that the website publishes. The allow-list is `clients/landing-page/src/content/docs-topics.json`. A published file's route drops its number: `documentation/references/cli/0006-sessions.md` becomes `/docs/references/cli/sessions/`. An extension's `README.md` becomes `/docs/extensions/<slug>/`, and its `docs/0004-cli.md` becomes `/docs/extensions/<slug>/cli/`. Anchors are GitHub-style heading slugs.
- Never link PRDs, architecture references, development guides, or lessons learned from a shipped skill. They describe how Prompt Studio is built, not how to use it, and are not published. Cite an ADR on GitHub only to explain a decision or a temporary limitation, as public pages may.
- Link source code on GitHub `main` only for complete public examples, such as Extension Lab. Say that `main` can be newer than the user's release.

## Content

Shipped skills route agents to the maintained contract. They do not copy it.

- Link the public contract at each decision the agent makes. Keep only short offline essentials: rules that agents get wrong and that the public pages do not state.
- Check every claim against current source. The type declarations of `@pstdio/sdk` are the authority for signatures.
- Label APIs that only some releases have. Name the extension API version that adds or deprecates them, and give the alternative for older hosts. The published SDK and the source can share a package version while their extension API versions differ.
- Give targeted checks. Do not tell agents to run a whole repository suite.
- Planner skills work in the user's repository. Keep the user's requirements, such as their PRDs and ADRs, separate from Prompt Studio's own product requirements.
- Raise `metadata.version` in a skill's front matter when its content changes.

## API changes

An extension API change is not finished until three places agree:

1. The contract reference in `documentation/references/` or `documentation/guides/`.
2. The walkthrough or example that uses it, such as [Write an extension](../extensions/0001-authoring.md) or the compiled examples in `create-pstdio-extension`.
3. The skill routing: the decision table and the version table in `create-pstdio-extension/references/extension-api.md`, and any skill step that names the API.

The `sdk-extension-separation` check rejects one pull request that changes both `packages/sdk` and `extensions/`. Update the contract and documentation with the SDK change. Update the skill routing in the extension pull request that follows, and link the two pull requests. Follow [API versioning](../../references/extensions/0014-api-versioning.md): deprecate first, and keep the old API in the skill's version table until the breaking release removes it.

## Validate a skill change

Skill text is documentation, so it does not need application tests. Run only these checks:

- Links: `bun run --cwd scripts verify:docs-links`. It checks relative links, exported skill folders, published routes, anchors, and private links. The [documentation guide](../0001-documentation.md#documentation-checks) lists the rules. External sites are checked weekly, not here.
- Examples, when you changed them: `bun run --cwd extensions/pstdio-skills test`.
- The two file-list tests above, when you added, renamed, or removed a file in `create-pstdio-extension`.
- Claims: run the commands the skill tells agents to run, against a disposable project, when you changed command guidance.

Add a `patch` changeset for each extension whose skills changed. Do not add a changeset for test-only changes.
