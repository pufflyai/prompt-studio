# Skill Browser

Install Skill Browser through the **Coding** onboarding group or the extension catalog. Open **Skills** above Settings in the project navigation footer; the first skill opens automatically. The sidebar groups skills by the extension that provides them; project skills have their own group.

The native read-only file viewer shows the filename and menu toggle together in its standard header. Its attached menu uses the shared parameter editor for **Info** and the standard file tree for **Files**; both sections collapse. Drag its divider to resize it, drag to the edge or press Home on the divider to close it, and use **Open Main right menu** to reopen it without losing the selected file.

The browser reads the project's resolved skill catalog through the public extension API. **Prompt Studio Skills** is a separate collection of skills for using Prompt Studio and authoring extensions.

Agents read the same catalog:

```sh
pst pstdio.pstdio-skill-browser list --json
pst pstdio.pstdio-skill-browser read --name create-pstdio-extension --json
```
