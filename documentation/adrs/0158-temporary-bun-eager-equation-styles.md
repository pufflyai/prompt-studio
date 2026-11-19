# Temporary Bun eager equation styles

Proposed: 2026-11-18

Status: Accepted for the installed UI package.

## External limitation

Bun 1.4.4 emits a stylesheet for a dynamically imported module and also copies its rules into the entry stylesheet. The installed UI package dynamically imports its equation renderer, but KaTeX rules and font references still reach the initial stylesheet for Planner Timeline and other webviews.

## Decision

Keep the exact KaTeX rules in their existing CSS asset and load that asset from the lazy equation chunk. Apply the transformation only when build metadata identifies the UI equation chunk as dynamically imported, and that chunk is the sole importer of KaTeX CSS. If the compiler reorganizes the rules so they cannot be matched exactly, retain the original eager styles.

## Removal

Move stylesheet loading to the equation renderer when the published UI package can ship and resolve its separate CSS and font assets in webviews. Remove the build transformation after installed Planner renders equations on demand and its initial Timeline CSS contains no KaTeX rules.
