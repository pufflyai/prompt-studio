# One view model for collection renderers

Proposed: 2026-10-02

## Status

Accepted for PS-472.

## Context

The kanban renderer and the data table both show collections, and both already used the kanban view bar and store. Their filter model could only say "field is one of these values". Order had two owners: the board's Display ordering and the table's own header sort. Neither had text search. Saved views existed only for boards ([ADR 0048](0048-shared-project-board-views.md)).

People expect what Notion and Airtable offer: conditions that fit the field type, And and Or groups, several sort levels, and a search box. Agents must be able to build the same views through `pst views` (mission rule 4).

## Decision

1. Both renderers use one view model: a filter that is one root group of rules, an ordered list of sorts, and renderer display settings. The Sort menu owns order. Display loses its Ordering row, and table headers write to the view's sorts.
2. One condition list per field kind, `VIEW_FILTER_CONDITIONS`, lives in the extension kernel of `pstdio-api-contracts` and is exported from `@pstdio/sdk/extensions`. `@pstdio/ui` imports it from there, as it already imports parameter types. The views API and the CLI read the same list, so a rule means the same in every place.
3. A group has one conjunction. The root group can hold one level of nested groups, and nested groups hold rules only.
4. Search is screen state. It narrows the visible rows, matches only text the view shows, and is never saved or sent to a query.
5. Evaluation stays in the browser. Queries receive `filter` and `sorts` and may narrow their result, but the renderer always applies the full view to what it gets.
6. Extension-declared data table views get shared saved views in `board_views`, next to board views. The views API calls both "boards" and reports their `kind`.
7. Data table grouping, row numbers, wrapping, statistics, and the column list are display settings of the view. Tables group by exact value with the same grouping helpers as boards, so one group order rule covers both.
8. The deprecated `filters`, `defaultFilters`, and `settings.ordering` are converted in one place, where the host reads a contribution. Queries still receive the deprecated fields, derived from the view. The deprecated fields are removed together in the next breaking extension API release.
9. Saved views keep their meaning through the upgrade. The one migration that adds `filter` and `sorts` converts each stored `filters` entry into an `is-any-of` rule and `settings.ordering` into one sort, then drops the old column. The field kind is not stored, so the views API's cleanup on read turns `is-any-of` into `has-any-of` for multi-value fields. The same cleanup keeps any rule meaningful when an extension changes a field between single and multi-value options.

## Options considered

### Filter model

- **Keep `Record<field, values>` and add a separate operator map.** Rejected. It cannot express Or between fields and would need a second structure kept in sync with the first.
- **A free query language string, such as `status != done and (assignee = alex or updated > -7d)`.** Rejected. People who never read code could not build it, and every client would need a parser.
- **A rule tree with fixed conditions (chosen).** It maps one to one onto the menus, the pills, the JSON API, and the CLI flags.

### Nesting depth

- **Unlimited.** Rejected. The menu becomes unreadable, and nothing in the current boards needs it.
- **One level (chosen).** It covers "A and (B or C)", which is the case people ask for.

### Search

- **Highlight only, like Airtable.** Rejected. On a board, matches spread across columns, so people would have to scroll and step through them.
- **Server-side search through the query.** Rejected for now. Every keystroke would run the extension's query, and queries already return the full set for local filtering.
- **Narrow and mark in the browser, like Notion (chosen).**

### Where the condition list lives

- **One copy in `@pstdio/ui` and one in `pstdio-api-contracts`.** Rejected. Two copies drift, and a drift lets the UI build views the API refuses.
- **One copy in the extension kernel, imported by `@pstdio/ui` through `@pstdio/sdk/extensions` (chosen).** `@pstdio/ui` already depends on `@pstdio/sdk`, and extension authors who build their own view UI read the same list.

### Existing saved views

- **Drop them, as PS-415 dropped locally saved views.** Rejected. These views are shared project data that people and agents built on purpose.
- **Convert them in the migration (chosen).** The data step follows the precedent of the contribution ID migration (0029): the migration file is generated from the schema, and only the conversion statement between adding the new columns and dropping the old one is written by hand.

## Consequences

- People and agents describe a view the same way, and the API refuses rules the UI could not show.
- Tables remember their sort, grouping, and columns, and extension tables can share views.
- Queries now re-run when the filter or sorts change, because they may narrow what they load. Typing a search never runs a query.
- Old extensions keep working. An extension that narrows its query with the deprecated `filters` only sees root "any of" rules (and "none of" rules on fields with declared options), so other conditions may load more rows than before. The renderer still filters them, so the result stays correct.
- First-party extensions resolve `@pstdio/sdk` from the registry, so they move from the deprecated fields to `defaultFilter` and `defaultSorts` after a release that contains them.
- Large collections still load in full. If a board grows beyond what the browser can filter, a later decision moves evaluation into the query. The `filter` and `sorts` that queries already receive make that possible without a new contract.
