# Skill Browser

Skill Browser is preinstalled. Open **Skills** above Settings in the project navigation footer; the first skill opens automatically. Select another skill from the sidebar.

The read-only viewer combines collapsible **Info** and **Files** sections in a details panel. Drag its divider to resize it, close it to focus on the document, and use **Show skill details** to reopen it without losing the selected file.

The browser reads the project's resolved skill catalog through the public extension API. **Prompt Studio Skills** is a separate collection of skills for using Prompt Studio and authoring extensions.

Agents read the same catalog:

```sh
pst pstdio.pstdio-skill-browser list --json
pst pstdio.pstdio-skill-browser read --name create-pstdio-extension --json
```
