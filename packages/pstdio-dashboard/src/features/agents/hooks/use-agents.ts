import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AgentInfo } from "../types";

const toAgentId = (id: string) => id.replace(/^pstdio\.harness\./, "");

export const useAgents = () =>
  useQuery({
    queryKey: ["agents-info"],
    queryFn: async () => {
      const harnesses = await apiRequest<Array<AgentInfo & { extension_id?: string }>>("/v1/harnesses/info");
      return harnesses.map((harness) => ({ ...harness, id: toAgentId(harness.id) }));
    },
  });
