import { apiClient } from "@/features/api-client";

export const command = "logout";
export const describe = "Remove this device from your account and stop syncing its cloud projects";
export const handler = async () => {
  await apiClient().account.logout();
  console.log("Logged out. Local projects stay on this device.");
};
