# Skills

A skill teaches your agent how you work, such as your review checklist, your writing style, or your research method.

## What skills give you

A skill is a folder with a `SKILL.md` file and optional supporting files. Its instructions teach an agent how to use a tool or how to do a kind of task. Extensions ship skills next to their tools, so an agent learns how to use a tool when you turn it on.

For example, Planner adds skills for its ticket workflow, and Prompt Studio Skills, which every new project includes, adds a skill for writing extensions.

## Use skills in Prompt Studio

Install the skills of your enabled extensions for one agent. Run this inside the project folder:

```sh
pst agents setup claude-code
```

This copies the skills into the project folder, where the agent reads them. Add `--global-skills` to install them in the agent's global folder instead. Run it again after you turn on a new extension. Prompt Studio also copies the skills into each workspace it prepares for a session.

The installed folders are copies. The source of a skill is the extension that ships it, so change a skill there. From the release after 0.43.x:

- `pst agents setup` and `pst agents install-skills <agent-id>` install only missing skills and keep existing skill folders, including ones you edited.
- `pst agents install-skills <agent-id> --force` replaces the folders of enabled skills with their source and discards local edits.
- The automatic copy updates only files that Prompt Studio wrote and that nobody edited.

To read skills in the dashboard, install the Skill Browser extension from the extension catalog, or choose **Coding** during onboarding. Then choose **Skills** above **Settings** in the navigation footer. It groups skills by the extension that provides them.

## Ship a skill with your tool

Put the skill folder in the extension package and declare it with `defineSkill`. This is how the Artifacts extension ships its skill:

```ts
defineSkill({
  id: "publish-artifact",
  title: l10n("skills.publish", "Publish an artifact"),
  source: packageAsset("./skills/publish-artifact", import.meta.url),
}),
```

List skills in `defineExtension({ skills })`. `packageAsset` paths must be relative and stay inside the package. A good skill tells the agent which of your tool's `pst` commands to run, so it works through the same commands as a person.

## Learn more

- [Agents and harnesses](../concepts/0003-agents.md#skills) explains where skills are copied.
- [Run agents](../getting-started/0004-run-agents.md#give-the-agent-skills) sets up skills for an agent.
- [CLI agents](../../references/cli/0002-agents.md) lists `pst agents` commands and options.
- [Skill Browser](../../../extensions/pstdio-skill-browser/README.md) describes the skills page.

*Updated at: 2026-11-22*
