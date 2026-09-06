# Temporary local dependency install context

## Intended behavior

The extension installer validates a prepared snapshot before replacing an installed extension. Bun resolves declared dependencies. Registry and archive dependencies remain usable after the author removes the source checkout. Local directory dependencies retain their declared filesystem ownership.

## External limit

Bun 1.3.14 records local directory resolutions relative to the source checkout in its lockfile, including when the manifest uses an absolute `file:` path. Copying an unchanged manifest and lockfile to installation staging then running Bun fails to find the provider. The regression test in `extension-development-dependencies.test.ts` reproduces this with a real provider and consumer.

## Temporary workaround

Resolve dependencies in the source checkout for development and for local installs that declare directory dependencies. Development links that dependency tree into the watched snapshot. Production copies the resolved tree and rebases its internal links, retaining external links to the declared provider directories. Keep normal production installs with registry or archive dependencies in staging.

This keeps the workaround in dependency preparation. It does not rewrite manifests or lockfiles, change author imports, bundle native extension code, or repair archives. The consumer checkout can be removed after production installation. Declared provider directories must remain available. Copying a large resolved tree costs disk space; publish or pack the provider when a portable install is needed.

## Removal

Remove the production directory-dependency branch when Bun can install an unchanged relocated lockfile against its declared directory paths, or exposes a supported separate dependency-output directory. Keep the real install and source-removal regression tests. Development still resolves dependencies in the watched checkout.
