# Webview hosts

These replacement contracts belong to PS-806’s 0.44 implementation. Extension adoption requires
the published 0.44 SDK and matching workbench. Older releases do not provide these replacements.

Workbench hosts share capability validation and response shapes. Supply service adapters when embedding extension webviews.

## Create capabilities

Import `createExtensionWebviewHostCapabilities` and `ExtensionWebviewHostAdapters` from
`@pstdio/workbench/extensions`. The factory provides every supported host capability name.
Each handler validates its parameters before invoking its service. The factory wraps results
such as `{ outcome }`, `{ location }`, and `{ name, value }` consistently.

`createWorkbenchWebviewHostAdapters` binds a workbench's commands, navigation, page parameters,
placement, preferences, notification display and terminal. Extension contribution registration
adds project-aware command execution, files and artifact reads. Pass additional services using
`createWebviewHostAdapters`; do not build or override a capability registry.

The dashboard binds HTTP-backed services. The testbench binds its preview services through the
same contribution registration. Services without a backing implementation stay undefined.
Their handlers throw `WebviewHostCapabilityError` with `code: "unsupported"` and
`data: { capability }`. Invalid parameters use `code: "invalid_params"` with validation issues.

## Frame lifetime

Pass the frame's stable `hostEvents` publisher to the adapters. The factory owns command abort
signals and the stream manager. Disconnect aborts pending commands and streams. Recreating the
adapters during a React render keeps the stream manager for that publisher.

A stream preserves its final command outcome. It never retries a disconnected command. A
frame accepts at most 16 active streams and 8 MiB of unread data; acknowledgements release
buffer capacity. These limits apply to all hosts.

See [extension webviews](../extensions/0005-webview-and-storage-api.md) for author-facing APIs.

Status bar webviews use their content width and the host status bar height. The guest runtime reports width changes, so a contributed view can update its text without choosing a fixed iframe size. Other regions fill the space assigned by the host.

The private bridge forwards pointer presses and clicks to the host iframe element. Shared menus and popovers can then dismiss on outside interactions without changing the webview sandbox or moving focus away from the clicked guest control. Webviews inside a menu remain part of that menu for containment checks.
