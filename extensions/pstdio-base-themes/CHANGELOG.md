# pstdio-base-themes

## 0.2.8

_2026-08-25_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.20.0`

## 0.2.7

_2026-08-24_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.19.0`

## 0.2.6

_2026-08-21_

### Patch Changes

- de6a77b: Version the extension API as `1.0.0-alpha.1` and refuse extensions that declare a different version or a range.
- 62aedfb: Make composition the sole owner of panel placement and expose placement-aware panel queries.
- Updated internal dependencies: `@pstdio/sdk@0.18.0`

## 0.2.5

_2026-08-13_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.17.0`

## 0.2.4

_2026-07-28_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.16.0`

## 0.2.3

_2026-07-09_

### Patch Changes

- ab0193c: Rename bundled core extensions to Prompt Studio labels and stabilize provision hooks.
- Updated internal dependencies: `@pstdio/sdk@0.15.0`

## 0.2.2

_2026-06-28_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.14.0`

## 0.2.1

_2026-06-23_

### Patch Changes

- aa22c92: Limit image diff preview payloads, ignore invalid image preview sources, and map image files to the Seti image icon.
- Updated internal dependencies: `@pstdio/sdk@0.13.2`

## 0.2.0

_2026-06-17_

### Minor Changes

- d8383a9: Extensions can contribute file icon themes that render in workbench file trees. New `pstdio-base-themes` extension ships Monokai, Solarized Light/Dark, Dracula, and the Seti file icon theme (the default for file trees); appearance themes/icons were removed from `extension-lab`. The theme picker now groups entries by light/dark.

### Patch Changes

- d8383a9: Align chat, diff, avatar, badge, tag, and Monaco editor colors with active theme tokens.
