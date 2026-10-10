# Native toolbar commands and dynamic choices

Declare `toolbarActions` on `dataTable` and `kanban` bodies. Each action has an
`id`, `label`, `command`, optional static `params`, optional `input` schema,
`submitLabel`, `icon`, `when`, `disabled`, and `presentation` (`primary` or
`secondary`). An input schema opens the shared command dialog. Actions remain
available on an empty view. Use at most one primary action.

For command dialog selects, `options` accepts a fixed array or
`{ command, valueField, labelField, params }`. The option command returns records
with string value and label fields. Use `params.valueOf("field")` in source
arguments to refresh choices when a sibling changes. The dialog handles loading,
retry, empty results, cancellation and stale results. `allowCustomValues: true`
lets users enter values as well as choose offered ones. Otherwise a selection
must belong to the latest result. The runtime does not repeat this lookup, and
CLI callers still pass explicit values; help marks command-backed fields.

Workspace-provider forms support command-backed choices and sibling dependencies
in Create workspace and nested `workspace` command fields. Providers must validate
resource ownership in `create`; choice lists do not authorize a resource.
Use fixed options on harness and kanban create-row forms.
Those forms do not use the command dialog. For a complete example, see the
[native toolbar reference](https://github.com/pufflyai/prompt-studio/blob/main/documentation/references/extensions/0004-contribution-api.md#native-view-toolbar-actions)
and [command-backed choices](https://github.com/pufflyai/prompt-studio/blob/main/documentation/references/extensions/0003-command-and-process-api.md#command-backed-choices).
