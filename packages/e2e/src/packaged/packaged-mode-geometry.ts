import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectPackagedModeGeometry = async (baseUrl: string, projectId: string, headers: HeadersInit) => {
  const response = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/ui`, { headers });
  expect(response.status).toBe(200);
  const metadata = (await response.json()) as WorkbenchExtensionMetadata;
  expect(metadata.modes.find((mode) => mode.localId === "arrangement")).toMatchObject({
    actionBarEdge: "top",
    layout: {
      axis: "horizontal",
      children: [
        "sidenav",
        {
          axis: "horizontal",
          children: ["side", { axis: "vertical", children: ["secondary", "main"] }],
        },
      ],
    },
  });
};
