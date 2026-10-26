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
