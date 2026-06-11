---
"pstdio": patch
---

Dispatch agent sessions to extension-contributed harnesses: the backend resolves namespaced harness ids from installed extensions (data migration included), per-project harness availability follows extension enablement (project-create agent selection disables unselected harness extensions; /agents/* accept a project filter), and CLI agent commands resolve bare ids against /agents/info. The legacy agent-config storage is gone: the agent_configs table, projects.selected_agents, and the /v1/agents config endpoints are removed; skills targets and session-default fallbacks derive from installed harnesses, and `pst agents` reduces to list/setup/install-skills.
