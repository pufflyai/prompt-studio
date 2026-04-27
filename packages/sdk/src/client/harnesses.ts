import type {
  CreateHarnessSessionInput,
  SendHarnessSessionInput,
  SetupAvailableHarnessesInput,
  SetupHarnessInput,
  UpdateHarnessInput,
} from "pstdio-api-contracts";
import type { HarnessConfig, HarnessInfo, HarnessModel, Session } from "../resources";
import type { RequestFn } from "./request";

export type HarnessClient = {
  list(): Promise<HarnessConfig[]>;
  info(): Promise<HarnessInfo[]>;
  models(harnessId: string): Promise<HarnessModel[]>;
  setup(input: SetupHarnessInput): Promise<HarnessConfig>;
  setupAvailable(input: SetupAvailableHarnessesInput): Promise<HarnessConfig[]>;
  update(harnessId: string, input: UpdateHarnessInput): Promise<HarnessConfig>;
  delete(harnessId: string): Promise<void>;
  startSession(input: CreateHarnessSessionInput): Promise<Session>;
  send(sessionId: string, input: SendHarnessSessionInput): Promise<Session>;
  stop(sessionId: string): Promise<Session>;
};

export const createHarnessClient = (request: RequestFn): HarnessClient => ({
  list: () => request("/v1/harnesses"),
  info: () => request("/v1/harnesses/info"),
  models: (harnessId) => request(`/v1/harnesses/${harnessId}/models`),
  setup: (input) => request("/v1/harnesses", { method: "POST", body: input }),
  setupAvailable: (input) => request("/v1/harnesses/setup-available", { method: "POST", body: input }),
  update: (harnessId, input) => request(`/v1/harnesses/${harnessId}`, { method: "PATCH", body: input }),
  delete: (harnessId) => request(`/v1/harnesses/${harnessId}`, { method: "DELETE" }),
  startSession: (input) => request("/v1/harnesses/sessions", { method: "POST", body: input }),
  send: (sessionId, input) => request(`/v1/harnesses/sessions/${sessionId}/send`, { method: "POST", body: input }),
  stop: (sessionId) => request(`/v1/harnesses/sessions/${sessionId}/stop`, { method: "POST" }),
});
