import type { AgentInfo } from "pstdio-api-contracts";
import { resolveHarnessName, toAvailabilityInfo } from "../harnesses/harness-registry-service";
import type { AgentsRouteDeps } from "./deps";

type Harness = Awaited<ReturnType<AgentsRouteDeps["harnessRegistry"]["list"]>>[number];
export const toAgentInfo = async (harness: Harness, projectId?: string) => ({
  id: harness.id,
  name: resolveHarnessName(harness),
  availability: toAvailabilityInfo(await harness.detect({ projectId })),
  ...(harness.skills
    ? { skills: { dir: harness.skills.dir, globalDir: harness.skills.globalDir, global_dir: harness.skills.globalDir } }
    : {}),
  ...(harness.params ? { params: harness.params as AgentInfo["params"] } : {}),
  capabilities: await harness.capabilities({ projectId }),
  supportsModels: harness.supportsModels,
});
