# Temporary Chromium viewport restoration after a tab closes

Proposed: 2026-10-20

Status: Accepted during PS-800 package validation.

## Intended design

Closing a temporary initialization probe or native-login popup should return the packaged browser test to its original tab with matching DOM and rendered viewport sizes. Normal Playwright clicks should reach every visible control.

## External limitation

In the provisioned full Chromium channel used by Playwright 1.60 on macOS, closing the probe changed the original page's recorded compositor viewport from 1280 by 720 to 1280 by 633. Its DOM viewport remained 1280 by 720. A click at y=687.89 completed in Playwright but did not reach the guest or start a host capability request. The behavior reproduced in the full package run and a focused diagnostic run. Firefox and WebKit passed the same workflow.

The application does not own Chromium's tab activation or compositor viewport. Changing the application layout or allowing more time cannot correct these mismatched browser coordinates.

## Temporary workaround

After closing the initialization probe or native-login popup, reactivate the original page and resize it one pixel taller before restoring its original configured viewport. Activation and reapplying the same size both reproduced the failure; the same-size request does not restore the compositor. The temporary size change forces a real browser resize. The original viewport is restored before further test actions. Use the shared [viewport restoration helper](../../packages/e2e/src/packaged/packaged-browser-viewport.ts) from the test helper that closes the temporary tab. Preserve all browser coverage, assertions, workloads and time limits. No application behavior changes.

## Limitations

The evidence is from macOS and the provisioned full Chromium channel. It does not establish a product bug or an issue in every Chromium build. The full Chromium workflow passed in 65 seconds with diagnostic tracing after the resize; it had failed before the resize. The normal workflow also runs in Firefox and WebKit with its original viewport and time limits.

## Removal

Remove the shared viewport restoration after a provisioned Chromium/Playwright upgrade keeps the original compositor size correct after temporary tabs close and both unchanged packaged workflows pass on the affected platform. Keep the initialization probe, native sign-in/cancellation flow and native-control assertions.

## Native-login evidence

PS-1068's controlled Cloud UI case reproduced the same mismatch with Playwright 1.60 and provisioned Chromium on macOS. After the first login popup closed, the main page's captured compositor changed from 1280×720 to 1280×633 while the configured viewport stayed 1280×720. A subsequent settings click at y=654.2 completed without reopening the surface. The command and panel were still registered; no overlay was created. The same control had worked before the popup closed. The captured evidence is in the PS-1068 change request RP-467.

The native-login helper now reuses the existing restoration after each popup closes. This keeps all original sign-in, cancellation, early-access, device and project-sync assertions and their allowances. After restoration, the captured main-page surface stayed at 1280×720 and native sign-in, cancellation, settings reopening and later device/project controls succeeded. The complete Cloud scenario has a separate remote-membership failure; viewport restoration does not waive that qualification gate.
