# Tag CLI

Planner tags define structured ticket fields. A tag can allow one selected option or several selected options.

## Commands

```sh
pst tags list
pst tags create --name <name> [--type <single_select|multi_select>]
pst tags update --tag-id <id> [--name <name>] [--type <type>] [--sort-order <number>]
pst tags options create --tag-id <id> --name <name> [options]
pst tags options update --tag-id <id> --option-id <id> [options]
pst tags options delete --tag-id <id> --option-id <id>
pst tags apply-draft --tag-id <id> [options]
pst tags delete --tag <tag>
```

The default type is `single_select`. Tag option commands accept `--color`, `--icon`, and `--description`.
Option updates also accept `--sort-order`.

```sh
pst tags create --name Priority --type single_select
pst tags update --tag-id default-priority --sort-order 0
pst tags options update \
  --tag-id default-priority \
  --option-id default-priority-urgent \
  --color red \
  --icon flame
pst tags delete --tag Priority
```

`apply-draft` updates a tag and its options in one write. Pass JSON arrays through `--options-to-create`,
`--options-to-update`, and `--option-ids-to-delete`. Use the individual option commands when changing option order.
