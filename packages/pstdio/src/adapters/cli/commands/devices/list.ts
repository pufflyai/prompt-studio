import { apiClient } from "@/features/api-client";

export const command = "list";
export const describe = "List the devices logged in to your account";
export const handler = async () => {
  const devices = await apiClient().account.devices();
  const rows = devices.map((device) => [
    `${device.current ? "*" : " "} ${device.id}`,
    device.name,
    device.platform,
    device.online ? "Online" : "Offline",
    device.lastSeenAt.slice(0, 16).replace("T", " "),
  ]);
  const table = [["  ID", "Name", "Platform", "Status", "Last seen"], ...rows];
  const widths = table[0].map((_, column) => Math.max(...table.map((row) => row[column].length)));
  for (const row of table) console.log(row.map((cell, column) => cell.padEnd(widths[column])).join("   "));
};
