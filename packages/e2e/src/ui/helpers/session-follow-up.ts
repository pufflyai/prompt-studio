import { type APIRequestContext, expect } from "@playwright/test";
import { uiOrigin as apiBase } from "../../ui-server";

export const deleteAllProjects = async (request: APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);

  const projects = (await response.json()) as { id: string }[];
  for (const project of projects) {
    const deletion = await request.delete(`${apiBase}/v1/projects/${project.id}`);
    expect(deletion.ok()).toBe(true);
  }
};
