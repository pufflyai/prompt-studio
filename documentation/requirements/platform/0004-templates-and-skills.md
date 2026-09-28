---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Templates and skills

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

Extensions can ship skills as package assets. Agent setup and skill-install flows copy enabled skills into the configured agent directory. Prompt Studio does not overwrite an existing installed skill with the same name.

Project skill edits remain stored through the host skill service. Installed agent copies are derived from that project content.

## Migration

When an existing database first starts on this architecture, Prompt Studio moves each live legacy template into the owning enabled extension's storage before dropping the old tables. Startup stops with a clear error if ownership cannot be resolved, so content is never discarded silently.
