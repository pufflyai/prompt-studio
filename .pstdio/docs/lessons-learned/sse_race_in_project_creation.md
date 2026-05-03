# SSE event arrives before API response completes

## What went wrong

An old e2e test for repo side effects during project creation failed. The test clicked "Create project", waited for the project name to appear in the UI, then immediately checked that filesystem side effects existed. The files were missing.

## Why

The project creation handler emitted an SSE event for the project before all follow-up repo bootstrap work finished. The dashboard received the SSE event and rendered the project name in the UI immediately. Meanwhile, the full API call chain was still in progress.

The test saw the project name via SSE and proceeded to assert file existence, but `registerRepo` hadn't been called yet.

## How it was solved

Added `page.waitForResponse` for the `POST /repos` endpoint before asserting file existence. This ensures the full API call chain completes before the test checks side effects.

## Key takeaway

When a test asserts side effects of a multi-step API call chain, wait for the final API response to complete rather than relying on UI elements that may appear early via SSE.
