---
"@pstdio/sdk": minor
---

HarnessProvider gains an optional `skills` layout ({ dir, globalDir }) declaring where the agent discovers skills; the KNOWN_AGENTS registry exports (KNOWN_AGENTS, findAgent, isKnownAgentId, KnownAgent) are removed and AgentInfo now carries the harness's skills layout. agents.info() accepts a project filter.
