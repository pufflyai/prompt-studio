# Separate model selection, session memory, and provider payloads

## 1. When to use

- Changing session creation, follow-up, agent selection, model defaults, or provider adapters.

## 2. Failure

- Treating every `model` value as the same contract sent an invalid OpenCode payload and restored the wrong selection in the dashboard.

## 3. Prevention

- Submit the agent and model currently shown to the person.
- For an existing session, initialize selection from its agent and `lastSelectedModel` before accepting changes.
- Persist the latest choice as `last_selected_model`; a session can use different models across turns.
- Apply the project default model only when the request omitted the agent and supplied no model, and the resolved agent matches that default.
- Keep provider-specific payload conversion inside the harness adapter.
- Cover selection through API persistence and provider conversion, including callers outside the monorepo.

## 4. Evidence

- [Session schema](../../packages/pstdio-db/src/db/schemas/sessions.ts)
- [Creation defaults](../../packages/pstdio-api/src/features/sessions/endpoints/resolve-create-session.ts)
- [OpenCode model conversion](../../extensions/harness-open-code/src/opencode-service.ts)
