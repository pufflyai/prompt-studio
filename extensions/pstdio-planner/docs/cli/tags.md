# Tag CLI

Planner tags define structured ticket fields. A tag can allow one selected option or several selected options.

## Commands

```sh
pst tags list
pst tags create --name <name> [--type <single_select|multi_select>]
pst tags delete --tag <tag>
```

The default type is `single_select`.

```sh
pst tags create --name priority --type single_select
pst tags delete --tag priority
```

Tag options, colors, and ordering are managed in the Planner settings UI. The CLI aliases create and remove tag definitions.
