import type { HarnessRegistryService } from "../harnesses/harness-registry-service";

type SessionHarnessIdentity = {
  agent: string | null;
  project_id: string | null;
};

export const getSessionHarness = (registry: HarnessRegistryService, session: SessionHarnessIdentity) =>
  session.agent ? registry.get(session.agent, { projectId: session.project_id ?? undefined }) : Promise.resolve(null);
