# Temporary native directory removal experiment

Proposed: 2026-10-26

Status: Diagnostic experiment, not accepted for delivery

## Intended design

The Bun test runtime should remove its owned complete fixture within the existing 120-second allowance. Junction targets and external hard links must survive. The operation must finish before the fixture returns.

## External limitation

The actual Windows fixture has about 85,800 files and 1,462 links. Standard Bun removal and Node variants have not passed both architectures within the whole-case allowance. This does not establish a generic runtime defect or prove that a clean product fix is impossible.

## Experiment

Compare standard Windows `rmdir` and .NET `Directory.Delete` against the same quiet compiled PS-932 plus PS-947 product. Each complete cold case retains installation, feature checks, shutdown and awaited removal. Use the existing owned test command runner, pass the root as environment data, and require ordinary-root disappearance plus an external junction and hard-link sentinel to survive. Record actual tree counts and elapsed time; record the PowerShell/.NET version and resources for that method.

## Limitations

This is measurement only. Inventory adds work and can affect filesystem cache state, so a quiet full-case qualification without inventory is still required before adoption. The .NET experiment requires PowerShell 7 on the Windows runner. No runtime source or delivery cleanup implementation changes.

## Removal

Save the evidence and delete the experiment. Adopt no native helper unless both architectures complete the original quiet workloads within their unchanged limits, resource ownership passes review, and a final temporary ADR explains the external cause and removal gate.

## Reparse metadata follow-up

Run 40278566333 rejects both removal candidates on both architectures. In particular .NET on x64 fails on entry `2.1.0@@@1` with an invalid-parameter error after about 30 seconds. A realpath ENOENT result alone does not identify a dangling directory junction. Record Bun Dirent/lstat/readlink information and Windows attributes plus the native reparse tag for that named entry before considering different link handling. Keep standard Bun cleanup during this measurement. Do not call the generic command runner a close guarantee on failure; it deliberately reports failed parents before inherited pipes close.
