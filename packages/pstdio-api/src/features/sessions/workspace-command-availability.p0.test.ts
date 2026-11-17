import { expect, test } from "bun:test";
import type { SessionsRouteDeps } from "./deps";
import { getDraftHarnessCommands } from "./draft-harness-commands";
import { getSessionHarnessCommands } from "./session-harness-commands";

const unavailableWorkspace = {
  project_id: "project",
  initializing: false,
  setup_error: null,
  provider_state: "provisioning",
};

const setup = () => {
  let calls = 0;
  const harness = {
    id: "harness",
    cwdRequirement: "optional",
    getCommandState: () => {
      calls++;
      return { commands: [], modes: [], slashCommands: true };
    },
  };
  const deps = {
    projectService: { get: async () => ({ id: "project" }) },
    harnessRegistry: { get: async () => harness },
    workspaceService: { getDefault: async () => unavailableWorkspace },
    workspaceSessionService: { getWorkspaceBySessionId: async () => unavailableWorkspace },
    sessionService: { get: async () => ({ id: "session", project_id: "project", agent: "harness" }) },
  } as unknown as SessionsRouteDeps;
  return { deps, calls: () => calls };
};

test("a draft can load its composer while workspace commands are unavailable", async () => {
  const { deps, calls } = setup();
  expect(await getDraftHarnessCommands(deps, { project_id: "project", agent: "harness" })).toEqual({
    commands: [],
    modes: [],
    slashCommands: false,
    harnessId: "harness",
  });
  expect(calls()).toBe(0);
});

test("background command discovery for an existing conversation tolerates an unavailable workspace", async () => {
  const { deps, calls } = setup();
  expect(await getSessionHarnessCommands(deps, "session")).toEqual({
    commands: [],
    modes: [],
    slashCommands: false,
    harnessId: "harness",
  });
  expect(calls()).toBe(0);
});
