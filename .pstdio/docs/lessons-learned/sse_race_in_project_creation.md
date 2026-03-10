# SSE event arrives before API response completes

## What went wrong

An e2e test for skill installation during project creation failed. The test clicked "Create project", waited for the project name to appear in the UI, then immediately checked that skill files existed on disk. The files were missing.

## Why

`createProjectHandler` emits an SSE event for the project at the start of the handler — before `seedDefaultSkills` finishes and before the HTTP response is sent. The dashboard receives the SSE event and renders the project name in the UI immediately. Meanwhile, the full API call chain (`POST /projects` → `seedDefaultSkills` → `POST /repos` → skill installation) is still in progress.

The test saw the project name via SSE and proceeded to assert file existence, but `registerRepo` (which writes skill files to disk) hadn't been called yet.

## How it was solved

Added `page.waitForResponse` for the `POST /repos` endpoint before asserting file existence. This ensures the full API call chain completes before the test checks side effects.

## Key takeaway

When a test asserts side effects of a multi-step API call chain, wait for the final API response to complete rather than relying on UI elements that may appear early via SSE.
