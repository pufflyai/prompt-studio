# Skill Browser

Install Skill Browser through the **Coding** onboarding group or the extension catalog. Open **Skills** above Settings in the project navigation footer; the first skill opens automatically. Select another skill from the sidebar.

The native read-only file viewer has a standard workbench menu with collapsible **Info** and **Files** sections. Drag its divider to resize it, drag to the edge or press Home on the divider to close it, and use **Open Main right menu** to reopen it without losing the selected file.

The browser reads the project's resolved skill catalog through the public extension API. **Prompt Studio Skills** is a separate collection of skills for using Prompt Studio and authoring extensions.

Agents read the same catalog:

```sh
pst pstdio.pstdio-skill-browser list --json
pst pstdio.pstdio-skill-browser read --name create-pstdio-extension --json
```
