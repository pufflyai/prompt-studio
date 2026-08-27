# pstdio-reports

## 0.4.0

_2026-08-27_

### Minor Changes

- d7a5b16: Move template content and editing workflows from core into owning extensions.

### Patch Changes

- 5329cb7: Replace overlapping extension UI contracts with alpha.4 views, placements, navigation, and shared workflow statuses.
- 40e4fd6: Add provider-backed workspace creation.
- 545d925: Pass command and middleware parameters as the second handler argument across the extension API.
- 545d925: Add stable workbench views and migrate extension navigation.
- 82138c3: Update the Bun toolchain requirement to 1.3.14.
- Updated internal dependencies: `@pstdio/sdk@0.21.0`

## 0.3.2

_2026-08-25_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.20.0`

## 0.3.1

_2026-08-24_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.19.0`

## 0.3.0

_2026-08-21_

### Minor Changes

- d34a989: Add stable report read and persistence contracts for implementation and review handoffs.

### Patch Changes

- e2b8668: rewrite documentation, skills, and templates in plain technical English
- de6a77b: Version the extension API as `1.0.0-alpha.1` and refuse extensions that declare a different version or a range.
- 62aedfb: Make composition the sole owner of panel placement and expose placement-aware panel queries.
- Updated internal dependencies: `@pstdio/sdk@0.18.0`

## 0.2.0

_2026-08-13_

### Minor Changes

- b4daee0: Add explicit, non-overwriting change request and review report workflows with no default report template.

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.17.0`

## 0.1.2

_2026-07-28_

### Patch Changes

- Updated internal dependencies: `@pstdio/sdk@0.16.0`

## 0.1.1

_2026-07-09_

### Patch Changes

- 1597b7c: Add workspace reports for agent handoff artifacts.
- 1597b7c: Load default report bodies from registered templates instead of an inline fallback.
- Updated internal dependencies: `@pstdio/sdk@0.15.0`
