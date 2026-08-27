# ADR 0014: Extension catalog as data

## Status

Accepted.

## Context

Core kept a TypeScript array of first-party extensions. Membership controlled listing, named installs, contribution previews, upgrades, recovery after an extension API change, and default installation. A third-party extension could not use those capabilities. The default set also included the planner because every catalog entry became a default, even though Prompt Studio core is not a project tracker.

Installed sources already record `<url>@<commit>#<path>` in `source_ref`. That value can identify a Git origin without a new database column.

## Decision

The extension catalog is a versioned JSON document. Prompt Studio ships one catalog and reads an operator override from `PSTDIO_EXTENSION_CATALOG`. The override may be a local path or an HTTPS URL. A fetched catalog is cached under the active Prompt Studio home and the cache is used when the remote catalog cannot be fetched.

Each entry declares its install name, display metadata, Git origin, release ref, publisher, and whether it is installed by default. Core code does not name extensions.

Upgrade eligibility belongs to the source. The host parses recorded Git provenance first, then uses the catalog entry for installs that predate provenance. A source with a pinned commit is upgradeable when the catalog release resolves to a different commit. A source without provenance gets a recovery upgrade only when its manifest is incompatible with the host. Healthy local copies stay under local control.

Catalog membership and default installation are separate. The packaged defaults are the three harnesses, base themes, and Prompt Studio skills. Planner, planner automation, and reports remain available in the catalog.

The catalog document is the trust boundary. It names code the host may clone and run. Remote overrides therefore require HTTPS, and the extensions panel shows the publisher and Git origin before installation.

## Consequences

Any catalog entry can come from its own repository and receive the same install, preview, upgrade, and recovery behavior as a first-party extension. Operators can replace the catalog without rebuilding core. Named installs fail with a catalog error instead of guessing a folder in the Prompt Studio repository.

Release lookup now runs per origin and ref, so the host caches those results. Catalog install names must be unique. If an installed source records a different origin for the same name, the host reports a conflict instead of replacing it.

No database migration is needed. Existing rows with `source_ref: null` use the catalog fallback. Rows with a recorded source remain self-describing.

## Alternatives

Keeping the array and adding a second list would preserve two classes of extension. Storing an `upgradeable` flag would duplicate origin state and drift. A hosted registry would also force publishing, signing, and availability decisions that the local catalog format does not require.
