# Temporary scroll content width override for panel tabs

Proposed: 2026-09-30

## Intended design

Panel tab content uses the viewport width. Tabs share that space and shrink before the viewport scrolls. The theme owns tab widths and minimum sizes.

## External limitation

Zag ScrollArea 1.35.3 sets `minWidth: fit-content` as an inline style on its content element. Chakra's `minW="0"` cannot override it. The content therefore expands to the tabs' natural widths even when its width is set to 100%.

## Decision

Use Chakra's important-value syntax for `contentProps.minW` in the workbench panel tab strip. This temporary workaround overrides the upstream inline minimum without changing other scroll areas or introducing another layout mode. Width and minimum width remain layout props; tab appearance remains in the shared recipe.

## Limitations

The local minimum-width declaration must outrank the upstream inline style. A normal theme declaration cannot do that with the current ScrollArea implementation.

## Removal

Remove the important suffix when Zag or Chakra allows the content minimum to be controlled by normal style props. Validate that crowded panel tabs shrink to 48 px before horizontal scrolling begins.
