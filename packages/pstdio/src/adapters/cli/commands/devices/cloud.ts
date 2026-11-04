import { apiClient } from "@/features/api-client";
export const command = "cloud";
export const describe = "List your cloud devices and their provider power and online states";
export const handler = async () => console.log(JSON.stringify(await apiClient().account.cloudDevices(), null, 2));
