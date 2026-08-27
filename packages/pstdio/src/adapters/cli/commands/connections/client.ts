import { createClient } from "@pstdio/sdk/client";
import { resolveApiUrl } from "@/features/api-url";

export const createConnectionsClient = () => createClient({ baseUrl: resolveApiUrl() }).extensions;
