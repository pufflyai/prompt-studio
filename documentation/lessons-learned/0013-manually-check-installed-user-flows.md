# Manually check installed user flows with an agent

## What kept going wrong

Changes worked in the source workspace but broke or slowed ordinary use of the installed product. Automated checks covered parts of the system without always proving that a new user could reach a working tool.

- [PR #802](https://github.com/pufflyai/prompt-studio/pull/802) removed an OpenCode extension's dependency on an SDK API that had not been published. The local workspace supplied that API; the released SDK did not.
- [PR #807](https://github.com/pufflyai/prompt-studio/pull/807) fixed unnecessary catalog downloads and development dependency installs during packaged project creation. Creating the first project had slowed from about 5 seconds to 12–14 seconds on macOS.
- [PR #808](https://github.com/pufflyai/prompt-studio/pull/808) added extension lockfiles after the first install fix. A cold Skills extension install then downloaded 9.4 MB instead of 535 MB.

Those fixes resolved the reported failures. They do not prove that every project and extension flow works in the next release.

## Lesson

For changes to project setup, extension management, startup, or packaging, an agent must also manually walk through the affected user flows. Use the product's normal interface and observe the result, including loading, errors, and whether the tool is usable.

An agent can use Playwright or another browser or native app tool for this walkthrough. Passing automated tests, typechecking an extension, or receiving a successful API response does not replace checking the complete flow.

## What to check

Use disposable projects and isolated runtime data. Choose the flows affected by the change; project and extension lifecycle changes should cover this sequence:

1. Start with a fresh user home and create a project through the normal interface. Confirm that setup completes and the project opens without manual repair.
2. Install an extension from a source users can install. For a release check, use its declared published dependencies outside the monorepo. Confirm that its tools appear and perform a real action with one of them.
3. Switch projects and reopen the project. Confirm that the extension is available in its intended scope and that the action's saved result is still present.
4. Remove the extension through the supported interface. Confirm that its tools disappear and other extensions still work. Check stored data and background work against the documented removal behavior.
5. Restart the app and reopen the project. Confirm that installation or removal persists and that no stale tools return. Reinstall the extension and use it again.
6. Repeat the affected setup flow with an existing installation. Compare a cold run, with no cached downloads, and a warm run, with cached downloads, when install or startup performance changed.

Check the actual packaged app when packaging or release behavior changes. A source checkout can supply files, APIs, or dependencies that the installed app does not have.

## Record the evidence

- App build or version, operating system, extension source and version, and dependency versions.
- Whether the data and download cache were fresh or reused.
- Each action, expected result, observed result, and time taken for setup or installation.
- Relevant screenshots, logs, and browser or runtime errors.
- Flows that were not checked and why.

If a flow fails, reproduce it and fix the cause before calling it validated. Add useful regression coverage under the repository's testing rules, then repeat the manual flow. Report a remaining failure or unchecked flow explicitly.

## Repository workflow

Use the isolated manual browser setup in the [contributor guide](../guides/0002-development-setup.md#playwright-validation): start with `bun run dev:playwright`, use its printed dashboard URL, and finish with `bun run dev:playwright:down`. Do not use the user's production projects or runtime data for destructive checks.

For installed desktop behavior, follow the isolation and packaged validation guidance in [Desktop application foundation](../references/0006-architecture-desktop.md). Keep automated packaged smoke checks as well as the manual walkthrough.
