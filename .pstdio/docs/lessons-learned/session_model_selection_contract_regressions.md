---
id: "session-model-selection-contract-regressions"
status: closed
severity: high
area: "sessions, dashboard, agents"
tags: ["sessions", "models", "opencode", "dashboard", "regression"]
created: "2026-05-09"
user_prompt: "a model might get changed across the session, we need to make it clear its the last selected model"
---

# Session model selection contract regressions

## Summary

Session model handling regressed because pstdio used the same word, `model`, for three different contracts: the user's currently selected model, the session's last selected model, and the provider-specific model payload. That blurred boundary let basic OpenCode session creation fail with HTTP 400 when the provider rejected a string model payload, and it also let the dashboard omit or restore the wrong model in session creation and follow-up flows.

This postmortem covers the confirmed model-selection and model-payload bugs found in the current fix and in recent git history.

## Impact

OpenCode sessions failed to start in the reported external-repo path even though Claude Code sessions still worked. The failure was visible as:

```text
OpenCode session.create failed: HTTP 400 ... "Invalid input: expected object, received string"
```

The failure broke the basic "start a session" workflow for OpenCode users and made the dashboard's selected model unreliable.

## What went wrong

1. We treated the UI model string as if it were also the OpenCode HTTP payload. OpenCode session creation requires `{ providerID, id }`; OpenCode message sending requires `{ providerID, modelID }`.
2. The dashboard new-session path did not have a regression test proving the selected agent-browser model reached `POST /v1/sessions`.
3. Existing session follow-up did not make the browser state explicitly session-backed before sending. The UI had to load the session's agent and last selected model before allowing the user to keep or change them.
4. The database column was initially named `model`, which implied an immutable session model. A session can change model between turns, so the persisted value is `last_selected_model`.
5. Project default model resolution had no narrow ownership rule. It is valid only when no agent is selected by the caller, such as plugin `createSession` calls that omit `agent`.
6. Our smoke testing covered isolated `prompt-studio` containers but did not prove OpenCode creation from another linked repo with the selected model.
7. Product and architecture docs did not state the model ownership boundaries, so reviews had no written contract to check against.

## Prior model bugs in the same area

### Configured OpenCode model was not selected for new sessions

Commit `b7b60d0c` (`fix: select configured OpenCode model for new sessions`, 2026-04-29) fixed a dashboard/provider split:

- The agent browser did not prefer the configured agent model when no manual model was selected.
- The initial OpenCode prompt message did not receive the selected model.
- Regression coverage was added around model selection helpers and OpenCode service behavior.

### Project default model state was not preserved cleanly

Commit `e8b04476` (`fix(PS-67): preserve agent default model state`, 2026-05-07) fixed project settings state:

- Switching the project default agent could clear the draft/default model at the wrong time.
- The UI now waits for the selected agent's models and persists an intentional default model selection.

### OpenCode provider payload used the wrong model type

The current regression sent this body to OpenCode session creation:

```json
{ "model": "openai/gpt-5.5" }
```

The observed OpenCode API rejected it. pstdio now converts the stored/requested model string at the provider boundary:

- Session create: `{ "model": { "providerID": "openai", "id": "gpt-5.5" } }`
- Session message: `{ "model": { "providerID": "openai", "modelID": "gpt-5.5" } }`

### Dashboard create/follow-up paths did not prove selected model propagation

The dashboard now has explicit tests that:

- A new session passes the selected model from the agent browser into `createSession`.
- `useCreateProjectSession` includes the trimmed model in the request body.
- Existing session selection starts from `session.lastSelectedModel`.
- Follow-up updates the session's `last_selected_model` when the user changes model.

### Session storage name hid mutable behavior

The session record now stores `last_selected_model`, not `model`. That name matches the behavior: the user can select a different model on a later turn, and the session remembers the latest selected value for the next follow-up.

## Correct contract

1. **Dashboard new session:** use the selected agent and selected model currently shown in the agent browser.
2. **Dashboard existing session:** first load `session.agent` and `session.lastSelectedModel` into the agent browser, then send whatever values are selected at submit time.
3. **API request body:** `model` means "model selected for this request", not "session model".
4. **Database session row:** `last_selected_model` means "latest model selected for this session".
5. **Project default model:** use only when the caller omitted `agent` and omitted `model`; this covers default-agent/plugin creation paths, not dashboard sessions with a selected agent.
6. **Provider boundary:** provider adapters convert pstdio's model string into the provider's required shape. No caller outside the provider adapter constructs OpenCode payload objects.

## Correction

The fix changed the system to follow the contract above:

- OpenCode service translates model strings into the two OpenCode-specific object shapes.
- Dashboard session creation and follow-up pass the selected model.
- Existing session chat initializes from `lastSelectedModel`.
- API create/follow-up persists and updates `last_selected_model`.
- The migration keeps fresh DBs and already-migrated dev DBs aligned.
- Startup failures are logged with session, project, agent, cwd, and model context.

## Corrective actions

Every future model-related change must preserve this test matrix:

1. DB/schema test for the session model field name and nullability.
2. API create-session test proving an explicit request model is persisted as `last_selected_model`.
3. API follow-up test proving a changed request model updates `last_selected_model`.
4. Dashboard action/hook tests proving selected model reaches create and follow-up request bodies.
5. Dashboard selection test proving existing sessions initialize from `lastSelectedModel`.
6. Provider test proving OpenCode create uses `{ providerID, id }`.
7. Provider test proving OpenCode message uses `{ providerID, modelID }`.
8. E2E smoke test creating an OpenCode session from a non-`prompt-studio` repo with a selected model, using a mocked OpenCode binary and mocked OpenCode HTTP server.

## Preventive actions

1. Do not add a generic `model` field to persisted session state. Persisted state must use `last_selected_model`.
2. Do not pass raw API request bodies through to provider clients. Provider adapters own provider-specific shapes.
3. Do not treat isolated `prompt-studio` validation as sufficient for agent session creation. External linked-repo smoke coverage is required for OpenCode, but CI must use hermetic provider mocks and must not launch real OpenCode or Claude Code.
4. Keep product and architecture docs updated when a behavior crosses dashboard, API, DB, and provider boundaries.

## Verification

The fix was verified with targeted tests for DB, API, dashboard selection/actions, CLI session fixtures, OpenCode provider payloads, and the external-repo OpenCode smoke test. Full validation passed with:

```sh
bun run validate
```

## Key takeaways

1. A string model id is pstdio's internal selection format; it is not automatically a provider API payload.
2. A session does not have a fixed model. It has a last selected model.
3. Basic creation paths need cross-boundary tests, not only provider-unit tests or isolated-app smoke tests.
