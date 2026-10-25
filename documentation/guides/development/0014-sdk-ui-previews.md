# Publish SDK and UI previews

Publish SDK and UI dependencies from `main` without publishing Prompt Studio.
Stable releases keep their shared Changesets version group.

## Publish a preview

Merge the SDK or UI change into `main`, then run **Release Packages** with
**channel: packages**. The same action is available from the CLI:

~~~bash
gh workflow run release-packages.yml --ref main -f channel=packages
~~~

The job generates a Changesets snapshot, builds SDK and UI, checks their public
exports, and installs and bundles consumers of both packed archives. It then
publishes only `@pstdio/sdk` and `@pstdio/ui` under npm's `preview` tag. UI depends
on the exact SDK preview published by the same run.

Read both versions in the workflow job summary. Each version ends with
`-preview.sha-<full source commit>`. A rerun of the same source produces the same
version and skips packages already published. Registry errors fail the run.
If publication stops after SDK, rerun the failed job to finish UI.

No generated versions are committed. This channel does not publish `pstdio`,
workbench, desktop, service images, host tags, or a GitHub release. It does not
change npm `latest` or open a stable version PR. See
[ADR 0107](../../adrs/0107-independent-sdk-ui-previews.md).

## Use the published versions

Set an extension's SDK and UI dependencies to the exact versions from the job
summary, then run `bun install` in that extension to update its lockfile.
Do not depend on the moving `preview` tag. Do not edit the SDK or UI source
package versions by hand.

Keep `engines.pstdio` set to the first extension API the code needs. The packed
SDK records its API version in `pstdio.extensionApiVersion`. The compatibility
check reads this metadata from npm, so a preview needs no host release tag.
When that API has no stable SDK yet, the check prefers a supporting preview inside
the extension's SDK dependency range, then the first supporting published preview.
This keeps existing nightly baselines working for extensions whose dependency
range selects an older stable SDK. Once a stable SDK supports it, the first
supporting stable SDK remains the baseline.

Push the dependency and lockfile changes and wait for the extension PR's checks.
Remove `waiting-for-release` only after its published dependency check passes.
A preview supplies types and helpers; it does not upgrade the running host.
Test an extension using new host APIs with a host that provides those APIs.

## Validate changes to this release path

~~~bash
bun test scripts/release/package-preview-version.test.ts scripts/release/package-preview-publish.test.ts scripts/verify/extension-api-registry.test.ts scripts/verify/extension-api-baselines.test.ts
bunx lerna run build --scope @pstdio/sdk --scope @pstdio/ui --include-dependencies
bun scripts/verify/published-type-exports.ts sdk ui
bun scripts/verify/public-package-consumer.ts sdk ui
~~~

The publisher also supports `bun run --cwd scripts release:packages:publish
--dry-run` after snapshot versioning and building in a disposable checkout.
It packs and validates the pair without registry credentials or publication.
