# ADR: Temporary asynchronous assertions for owner errors

Proposed: 2026-10-26

## Status

Proposed. Native Windows verification is required before attributing the failures solely to the test runner.

## Context

Two real-owner regressions use `await expect(promise).rejects` to check an ordinary extension error and an unsupported return payload. Native Windows Bun 1.4.4 reaches the existing 15-second test allowance without settling the assertions. Cleanup then disposes the owner and the assertion sees that disposal error. Both JSON and Bun-native IPC framing reproduce the failure. The same tests pass on macOS development execution.

Upstream [Bun issue 46506](https://github.com/oven-sh/bun/issues/46506) describes an asynchronous rejection that settles with normal promise awaiting but hangs in `.rejects`. [Issue 45020](https://github.com/oven-sh/bun/issues/45020) describes the nested assertion loop blocking while promise continuations need to run. These are evidence for a test-runner hypothesis, not proof of this Windows failure's cause.

## Decision

Await these two operations through normal asynchronous promise rejection handlers, then assert the captured errors synchronously. Keep the same real subprocess, operations, error codes/messages, and execution allowance. Also verify that the owner remains available after the command error. Restore JSON IPC framing because the alternative did not resolve the observed failure.

This is confined to these integration assertions. Production scheduling, timers and transport receive no workaround. A successful command must still fail the negative assertion; errors must remain real `Error` values with the expected details.

## External limitation

The ideal test runner processes the same native callbacks under an asynchronous matcher as under normal `await`. We cannot repair Bun's nested event loop in this repository. Native Windows must confirm that ordinary awaiting restores the expected behavior. If it does not, continue investigating the runtime and do not declare the failure fixed.

## Removal

After a supported Bun release fixes the relevant behavior, restore direct asynchronous matchers and verify both regressions on native Windows with the existing allowance. Remove this temporary assertion choice only after that proof. No platform skip, reduced workload, retry or increased timeout is permitted by this decision.
