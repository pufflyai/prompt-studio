# Temporary: Package the shared filter control with Planner

Proposed: 2026-10-12

## Intended design

Planner imports `CollectionFilter` from the public `@pstdio/ui/collection-view` entry. The UI package owns the picker, criteria bubbles, styling, and interactions. Planner owns the ignore filter value.

## External limitation

The released UI package does not export a standalone filter control. Its collection bar always includes saved views and search. The next UI release will include the standalone control, but that release does not exist in the registry yet. Portable extension installs and published-dependency checks currently use the released package.

## Decision

Build a small, generated browser module from the public UI entry and package that module with Planner. External runtime dependencies remain package imports. A TypeScript declaration describes the packaged control through existing public SDK and UI types. The component source remains in the UI package; no source implementation is copied or maintained in Planner.

The Planner build regenerates the module after the UI build. Planner declares `@pstdio/ui` as an Nx implicit dependency to enforce that order. Its package dependency cannot do this: it names the released UI version, which stops matching the workspace version when a release PR raises it. CI checks committed build output, published extension dependencies, and packaged runtime behavior. This is a temporary packaging workaround, not a second filter implementation.

## Limitations

The generated module adds some UI code to Planner's package. UI changes require regenerating this module until the next released UI package supplies the export. The packaged declaration must stay aligned with the public component props.

## Removal

Once a UI release containing `CollectionFilter` is available, update Planner's UI dependency range and import that export directly. Remove the generated module, its declaration, its build script, the Nx implicit dependency on `@pstdio/ui`, and the related build, formatter, and dependency-scan configuration together. Keep the public UI component and its stories.
