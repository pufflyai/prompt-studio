# Temporary macOS activation for directly launched desktop tests

Proposed: 2026-11-14
Status: Accepted for the test launcher; native release qualification remains separate.

## Decision

After the packaged workbench becomes visible, the macOS functional-test launcher requests activation of its exact owned process through AppKit. The short `osascript` process uses the existing owned-process fixture and cleanup. A missing application or refused request fails setup. Product assertions and operation deadlines remain unchanged.

## External limitation

The fixture directly executes the app binary so it can own its process, output and shutdown. This bypasses LaunchServices. Local failures showed a visible, document-focused workbench with a desktop bridge, but its attempted mouse clicks delivered no DOM pointer events. The same picker failure reproduced on the exact main tree. Bringing the CDP page forward and targeting the option did not repair it.

AppKit activation with options zero was refused on this host. The forced-activation option (`2`) accepted the request and all four previously failing product cases passed through their owning runner. This option is deprecated; the installed SDK says it has no effect since macOS 14. These observations do not establish a portable API guarantee. [Apple documents application activation](https://developer.apple.com/documentation/appkit/nsrunningapplication/activate(options:)).

## Limitations

A successful request is not proof that the application is already frontmost. The subsequent real mouse, keyboard, persistence and restart assertions remain mandatory. The workaround is confined to macOS functional-test setup and does not certify startup performance, signed release artifacts or the M5 target. Linux and Windows launch behavior is unchanged.

## Removal

Replace direct execution with a LaunchServices launcher that retains exact application-PID ownership, isolated environment, output and cleanup. Remove the AppKit request after first-attempt validation of the four affected flows on the local host and required macOS CI hosts. Do not replace it with longer waits or repeat attempts until they pass.
