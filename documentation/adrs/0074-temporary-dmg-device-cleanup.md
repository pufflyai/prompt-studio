# Temporary DMG cleanup by device identity

Proposed: 2026-10-14

Status: Accepted

## Intended design

The DMG builder owns the disk image it attaches. It must retain that image's device identity and detach that device before removing the temporary image. A volume's mount path is only where its files are visible; unmounting the volume does not necessarily detach the image.

## External limitation

Electron Forge's DMG maker uses appdmg 0.6.6. Its attachment helper returns only the mount path, and cleanup passes that path to `hdiutil detach`. No published appdmg version exposes the attached device to its cleanup step. The native reproduction leaves the image attached after unmounting its volume; cleanup by the former mount path then fails with `No such file or directory`.

A configuration change cannot supply the lost device identity. Replacing the complete DMG builder would also replace its supported layout, background artwork, icons, format conversion, and cleanup pipeline.

## Temporary workaround

A TypeScript subclass of the existing Forge DMG maker temporarily adapts appdmg's attachment and detachment helpers during one make operation. Attachment reads native `hdiutil` property-list output and retains the device together with the mount path. appdmg continues using the mount path to lay out the image; cleanup passes the retained device to its existing detach helper.

The adapter restores the dependency's helpers when the make operation settles. It changes no other native commands, busy-device handling, retries, time limits, image contents, or artifact names. Cleanup failures remain failures.

## Limitations

The adapter depends on appdmg's private callback interface. It is isolated in the desktop packaging code and loaded only while making a macOS DMG. The desktop sidecar already requires the native platform and architecture; the supported invocation makes one architecture per process. Overlapping make operations in one process are outside that support. Native regression coverage verifies the actual attachment lifetime. Hosted Intel and Apple Silicon builds must verify the complete DMG and ZIP outputs.

## Removal

Remove the adapter and this temporary decision when the DMG dependency retains and detaches its image device through a supported API. Upgrade the dependency, run the native unmounted-volume regression, and verify complete DMG and ZIP builds on both macOS architectures before returning to the standard Forge maker.

## References

- PS-717 and PR #1089.
- [appdmg attachment and cleanup](https://github.com/LinusU/node-appdmg/blob/master/lib/hdiutil.js).
- [Upstream missing-mount report](https://github.com/LinusU/node-appdmg/issues/229).
