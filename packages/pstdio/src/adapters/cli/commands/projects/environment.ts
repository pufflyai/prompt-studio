import { apiClient } from "@/features/api-client";

export const command = "environment";
export const describe = "Print this runtime's stable local environment identity";
export const handler = async () => console.log(JSON.stringify(await apiClient().runtime.environment()));
