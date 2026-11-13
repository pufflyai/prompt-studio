---
"canvas": patch
"extension-lab": patch
"harness-claude-code": patch
"harness-codex": patch
"harness-open-code": patch
"harness-pi": patch
"pstdio-artifacts": patch
"pstdio-base-themes": patch
"pstdio-cloud": patch
"pstdio-home": patch
"pstdio-notes": patch
"pstdio-onboarding": patch
"pstdio-performance": patch
"pstdio-planner": patch
"pstdio-reports": patch
"pstdio-session-browser": patch
"pstdio-skills": patch
"pstdio-workspaces": patch
"remote-workspaces": patch
---
Prepare bundled extensions for API 0.5 without dropping their existing host ranges, and return Planner, Reports and Artifacts paths and links using the host-provided owner.

Use publisher-qualified Planner and Reports commands in shipped skills, prompts, help examples and documentation so agent instructions also work after the API 0.5 shortcut removal.

Keep ticket page ancestry and fresh draft ignore rules on the host-provided owner, including timeline rows, pulls and workspace provisioning.
