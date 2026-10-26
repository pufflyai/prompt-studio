# Temporary resolution of native CLI packages

Proposed: 2026-10-26

Status: Accepted.

## Decision

Each native harness locates its CLI on PATH first, then its private, pinned CLI dependency. Prompt Studio's existing extension installer downloads the dependency and its platform packages. Enabling a harness never changes the global PATH or installs a global CLI.

Locate the native executable directly in the platform package. Use the same resolver for availability, model discovery, session launch, and account actions. Provider credentials stay with the provider's CLI. Account discovery reads native status without starting sign-in. A dedicated authenticated channel carries provider choices, browser links, and masked replies outside commands and conversation history. Each harness saves credentials through its native authentication interface. CLI availability and account state are separate.

The optional `HarnessProvider.getAuthentication` addition shares the unreleased extension API 0.3.0 version step. SDK/host support and extension adoption need separate release changes.

## External limitation

Ideally the upstream packages would expose their installed native executable through a stable discovery API. Their wrappers currently depend on Node or install scripts. Prompt Studio deliberately installs extension dependencies with scripts disabled. The platform packages already include the native executables, but their internal paths are implementation details.

Claude Code exposes login through CLI output rather than a structured authentication API. Its adapter extracts the browser URL and submits the returned authorization code over the native process stdin. Output parsing stays inside the adapter, uses the pinned CLI version, and never exposes raw process output.

OpenCode's provider API reports connected providers but does not distinguish stored credentials from anonymous custom providers. Its adapter reads only provider IDs from the native XDG `opencode/auth.json` store to identify removable credentials. Native API calls perform every credential write and removal. Credentials supplied through `OPENCODE_AUTH_CONTENT`, environment variables, or configuration remain managed outside the chat.

## Limitations

Package layout knowledge stays in each harness's resolver and is tested against its pinned dependency. CLI updates need resolution and protocol checks. Private dependencies are downloaded with the extension even when a CLI already exists on PATH. Platform support follows the native packages shipped by each provider; unsupported platforms report the missing CLI rather than attempting an unrelated installer.

## Removal

Replace direct native-path resolution when upstream packages offer an executable discovery API that works with install scripts disabled and without a global Node installation. Keep version checks and the common Sign in interaction.

Replace Claude's text adapter when its CLI exposes structured login callbacks. Keep provider selection, private replies, and session setup states unchanged.

Replace OpenCode's store reader when its provider API exposes credential ownership. Keep native API writes and provider-specific readiness.
