---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# CLI Tags

Ticket tags are planner extension data. The core backend no longer stores
`ticket_tags`, `ticket_tag_options`, or `ticket_tag_assignments`, and tag
management commands are planner command aliases.

## Purpose

Tags are typed field definitions that can be assigned to planner tickets for
structured categorization. Each tag has a name, a type (`single_select` or
`multi_select`), and ordered options.

## Default Tags

| Tag Name     | Type            | Options                                    |
| ------------ | --------------- | ------------------------------------------ |
| `label`      | `single_select` | `bug`, `feature`, `documentation`, `chore` |
| `complexity` | `single_select` | `low`, `medium`, `high`                    |
| `priority`   | `single_select` | `P1`, `P2`, `P3`                           |

## Commands

Tag commands resolve the current project from `.pstdio/config.json` unless a
project id flag is provided by the router.

```sh
pst tags list
pst tags create --name "priority" --type single_select
pst tags delete --name "priority"
```

The commands execute planner extension commands such as
`pstdio-planner.ticketTag.read`, `pstdio-planner.ticketTag.create`, and
`pstdio-planner.ticketTag.delete`.

## Colors

Tag option colors use the shared palette:

`gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`,
`blue`, `indigo`, `violet`, `purple`, `pink`, `rose`.
