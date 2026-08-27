import { createClient } from "@pstdio/sdk/client";
import { resolveApiUrl } from "@/features/api-url";

export const createTokenClient = () => createClient({ baseUrl: resolveApiUrl() }).automation;
