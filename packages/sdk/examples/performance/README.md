# Public performance consumer

This example contributes a control inside Developer settings. It uses only the public SDK and UI packages. The host enforces declared permissions and a local user interaction before changing collection. Registration and reads do not start monitoring.

Copy these two source files into an extension. Install the SDK version that shipped this example and its matching UI package, plus React, React DOM, and `@chakra-ui/react`. Use `extension.ts` as the package entry and declare the host's supported extension API version. Keep the files together so the packaged asset path resolves.

A mounted consumer calls `await client.performance.retain()` and releases the returned lease on unmount. Captures are shared with the existing host control. Releasing the last owner stops its collector without changing the saved enabled preference. Bridge disconnect also releases that consumer.

For a widget, use `client.performance.snapshot()` or `await client.performance.subscribe(listener)` and call the returned disposer on unmount. Version 2 snapshots contain the same bounded timestamped capture returned by `pst performance`. A browser host exposes unavailable process metrics instead of invented zero values. Closing a view does not start a replacement collector.

The example deliberately does not register a second performance widget. PS-725 owns migration of the existing widget after the prerequisite host and SDK release.
