# Temporary Chromium viewport restoration after a probe tab closes

Proposed: 2026-10-20

## Status

Accepted during PS-800 package validation.

## Intended design

Closing the temporary initialization probe should return the packaged browser test to its original tab with matching DOM and rendered viewport sizes. Normal Playwright clicks should reach every visible control.

## External limitation

In the provisioned full Chromium channel used by Playwright 1.60 on macOS, closing the probe changed the original page's recorded compositor viewport from 1280 by 720 to 1280 by 633. Its DOM viewport remained 1280 by 720. A click at y=687.89 completed in Playwright but did not reach the guest or start a host capability request. The behavior reproduced in the full package run and a focused diagnostic run. Firefox and WebKit passed the same workflow.

The application does not own Chromium's tab activation or compositor viewport. Changing the application layout or allowing more time cannot correct these mismatched browser coordinates.

## Temporary workaround

After closing the initialization probe, reactivate the original page and resize it one pixel taller before restoring its original configured viewport. Activation and reapplying the same size both reproduced the failure; the same-size request does not restore the compositor. The temporary size change forces a real browser resize. The original viewport is restored before further test actions. Keep these actions inside the test helper that creates the probe. Preserve all browser coverage, assertions, workloads and time limits. No application behavior changes.

## Limitations

The evidence is from macOS and the provisioned full Chromium channel. It does not establish a product bug or an issue in every Chromium build. The full Chromium workflow passed in 65 seconds with diagnostic tracing after the resize; it had failed before the resize. The normal workflow also runs in Firefox and WebKit with its original viewport and time limits.

## Removal

Remove the explicit viewport restoration after a provisioned Chromium/Playwright upgrade keeps the original compositor size correct after the probe closes and the unchanged packaged workflow passes on the affected platform. Keep the initialization probe and native-control assertions.
