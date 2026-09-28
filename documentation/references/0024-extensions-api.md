# Extension API reference

Extensions use the public `@pstdio/sdk/extensions` entry point. Package identity and supported host contracts live in `package.json`; the default `defineExtension()` export declares contributions.

## Reference pages

| Page | Contents |
| --- | --- |
| [Manifest and installation](0048-extension-manifest-and-installation.md) | Identity, dependencies, host compatibility, installation, updates, source layout, and IDs |
| [Commands and processes](0049-extension-command-and-process-api.md) | Command outcomes, connections, middleware, hooks, background work, process limits, and contract migrations |
| [Contributions](0050-extension-contribution-api.md) | Views, pages, modes, controls, keybindings, dashboard composition, and appearance |
| [Webviews and storage](0051-extension-webview-and-storage-api.md) | Guest bridge, capabilities, files, navigation, terminals, package assets, and artifact mounts |

## Related contracts

- [SDK entry points and HTTP methods](0043-sdk-reference.md)
- [Lifecycle automation](0025-extension-lifecycle-automation.md) and [durable automation](0027-extensions-durable-automation.md)
- [Modes and layout](0028-extensions-modes-and-layout.md)
- [Renderer edit and refresh lifecycle](0031-extensions-renderer-edit-refresh-lifecycle.md)
- [Notifications](0030-extensions-notifications.md)
- [Remote execution](0016-architecture-remote-execution-and-automation.md)

## Getting started and validation

Start with [extension authoring](../guides/0006-extension-authoring.md) and the [workbench cookbook](../guides/0007-workbench-cookbook.md). The [runtime smoke guide](../guides/0011-extension-smoke-checks.md) explains what a passing smoke check covers. Also manually check the affected [installed user flows](../lessons-learned/0013-manually-check-installed-user-flows.md).

Host implementation types live in the [extension kernel](../../packages/pstdio-api-contracts/src/extension-kernel/index.ts). Consumers import only the public SDK; private host paths are implementation references, not supported imports.
