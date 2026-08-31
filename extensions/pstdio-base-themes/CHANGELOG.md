# pstdio-base-themes

## 0.3.0

_2026-08-31_

### Minor Changes

- c84459e: Define one contribution-ID grammar (lowercase kebab-case segments separated by dots), enforce it as an error in `pst extensions check`, resolve host-published refs without owner prefixing for every contribution kind, rename first-party ids to the grammar (extension API 1.0.0-alpha.6), and migrate stored automation scopes, runs, schedule and skill preferences to the renamed ids.

### Patch Changes

- 01911e8: Add typed workbench pages, panels, locations, regions, and navigation validation.
- Updated internal dependencies: `@pstdio/sdk@0.22.0`

## 0.2.9

_2026-08-27_

### Patch Changes

- 5329cb7: Replace overlapping extension UI contracts with alpha.4 views, placements, navigation, and shared workflow statuses.
- 40e4fd6: Add provider-backed workspace creation.
- 545d925: Add stable workbench views and migrate extension navigation.
- 82138c3: Update the Bun toolchain requirement to 1.3.14.
- Updated internal dependencies: `@pstdio/sdk@0.21.0`

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
