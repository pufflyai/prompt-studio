# Temporary CLI console stream binding

Proposed: 2026-10-18

## Status

Accepted as a temporary workaround. It is not the intended design; see [Removal](#removal).

## Intended design

`pst` writes results with `console.log` and errors with `console.error`. A terminal, a file, and a pipe all receive the complete output. The CLI waits for pending output before it ends the process with an exit code.

## External limitation

Bun 1.4.2 sets `O_NONBLOCK` on file descriptor 1 when `process.stdout` is first created. The CLI cannot avoid that: yargs reads `process.stdout` to find the terminal width. After that, Bun's global `console.log` drops every byte that does not fit into a full pipe. A slow reader such as `tee` received only 65,536 bytes of a 457,705-byte `pst extensions check --json` result. The command still exited with code 0. Redirecting to a file was not affected, because file writes do not block.

The Node stream API is not affected. `process.stdout.write` queues the rest and calls its callback after the bytes are written. Bun does not expose `_handle.setBlocking`, so the CLI cannot make the descriptor blocking again.

## Temporary decision

The CLI entry point, `packages/pstdio/src/index.ts`, replaces the global `console` with a `node:console` `Console` before it imports any command module. Command modules capture `console.log` as a default when they load, so a later binding would miss them. The new console writes to two small forwarding streams, one for `process.stdout` and one for `process.stderr`. Each forwarding stream finishes a write only when the target stream's write callback runs. Every path in `cli-main.ts` that ends the process with an exit code first ends both forwarding streams and waits for them to finish. Usage errors are thrown from the yargs `fail` handler and reported in one place, because yargs keeps parsing when that handler returns.

The binding lives in `packages/pstdio/src/features/cli-output.ts` and is installed only by the CLI entry point. Command code keeps using `console.log`. Tests that call command handlers directly are not affected.

## Limitations

- Code that writes to `process.stdout` directly, such as `pst serve` and `pst close`, bypasses the tracked streams. Those commands print short lines and end naturally, so Bun's stream writer still drains them.
- Output written after the CLI starts its exit is lost. Nothing in the CLI writes at that point.
- If the reader closes the pipe early, the CLI exits without waiting for the rest.

## Removal

Remove the console binding when the minimum supported Bun version delivers complete `console.log` output to a slow pipe after `process.stdout` exists. Check with `packages/e2e/src/cli/piped-output.test.ts` against the new Bun version. Keep waiting for output before exit; Node-compatible streams need it in any case.
