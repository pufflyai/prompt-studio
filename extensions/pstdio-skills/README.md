# Prompt Studio Skills

Shared skills for using Prompt Studio and creating extensions. This extension is installed by default.

## Ticket refinement options

Open project settings, select **Extensions**, then **Prompt Studio Skills**. In its settings, toggle **Generate an artifact prototype for UX features**. It is on by default. The option applies when refining a new feature with UX changes and Artifacts is installed and enabled for the project. Other tickets do not need a prototype.

Agents read the same project option with `pst pstdio-skills refinement-policy`. The result contains `generateArtifactPrototype`. The Planner refine prompt and refine-ticket skill use it before publishing and linking the prototype. An unavailable Artifacts extension or a disabled option is recorded in the ticket; refinement does not install extensions automatically.

Install **Artifacts** from Extensions when you want prototypes. Its package name is `pstdio-artifacts`, and it is optional. Published prototypes remain project-local and retain earlier revisions.

Future shared skill workflow options belong in this extension's settings. Planner's implementation review and PR settings stay in Planner.
