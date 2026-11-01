# Temporary ownership of Lexical typeahead anchors

Proposed: 2026-10-30

Status: Accepted

## Intended design

Each editor should supply a unique menu anchor ID and option IDs. Lexical should use those IDs for positioning and accessibility references. A retained workbench should hide its editor menus through the same activation contract as its other overlays.

## External limitation

The pinned `@lexical/react` 0.40.0 typeahead plugin exposes its anchor ref through `menuRenderFn`, but has no anchor-ID option. It writes `id="typeahead-menu"` and the editor's matching `aria-controls` during positioning, including resize and scroll updates. Its scrolling helper looks up that fixed ID in the document. It also uses the `typeahead-item-<index>` convention for `aria-activedescendant`.

Hiding only our rendered menu content leaves Lexical's outer listbox visible to accessibility. Assigning another anchor ID once is insufficient because later positioning writes the shared ID again. The public `parent` option changes the anchor's container without removing its document-wide ID assumptions.

A clean integration needs a configurable ID API in Lexical. Replacing its selection and typeahead implementation would be a much larger change than the host visibility contract.

## Temporary decision

Keep the integration in `packages/ui/src/components/rich-text/shared/use-typeahead-scope.ts`:

- Apply `hidden` and `inert` to the public anchor ref when its workbench is inactive. Keep its content mounted.
- Give an inactive anchor a unique ID. While inactive, observe only that anchor's ID attribute and restore its unique ID if Lexical repositions it. Disconnect the observer on activation or removal.
- Restore Lexical's conventional anchor ID when active. Only one workbench may be active in a window.
- Our prompt menu uses Lexical's option-ID convention while active and unique option IDs while inactive.

This is temporary compatibility code for an external library. Other workbench overlays use their normal scoped roots and need no observer.

## Limitations

An inactive open typeahead menu has one narrowly scoped MutationObserver. This depends on Lexical's current ID conventions and must be checked when updating the dependency. The active-workbench contract does not support several simultaneously active workbenches in one window.

## Removal

Remove the ID observer and conventional-ID restoration when Lexical supports caller-supplied menu and option IDs, or when Prompt Studio adopts a menu implementation with that contract. Pass stable unique IDs through that API, update the prompt menu's option references, and retain the normal hidden/inert ownership. Validate two retained editors with open menus across activation and window resize before deleting this ADR's temporary implementation.
