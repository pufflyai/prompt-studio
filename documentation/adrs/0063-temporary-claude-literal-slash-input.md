# Temporary Claude literal slash input

Proposed: 2026-10-02

## Decision

Keep explicit native command input separate from ordinary prompt input inside the Claude extension. Wrap an ordinary prompt beginning with a slash command in a `user-message` text element before sending it to Claude. Keep the original text in the visible conversation. Native command operations send the original command directly.

## External limitation

Claude Code 2.1.287 interprets slash input as commands in both string and text-block stream input. `--disable-slash-commands` rejects the command instead of sending its text to the model. The CLI has no verified literal slash input field in this transport.

Ideally the native protocol would accept command intent separately from literal user text. The current transport cannot represent both with the same raw string.

## Temporary workaround

The extension wraps only ordinary slash input. The wrapper preserves the user's text and prevents CLI command parsing. The transcript normalizer removes this exact wrapper when restoring the visible prompt. The native command operation bypasses wrapping. Core keeps command dispatch and ordinary prompting separate and has no Claude-specific flag.

## Limitations

The model sees a small text wrapper around literal slash input. This can affect tokens and prompt caching. The wrapper is not used for ordinary prose or explicit native commands. This is a temporary workaround, not the intended native input design.

## Removal

Remove the wrapper when Claude's supported transport provides a verified literal input option. Keep existing transcript normalization until older wrapped turns are no longer supported.
