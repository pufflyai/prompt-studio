import { type APIRequestContext, expect } from "@playwright/test";
import { folderProjectInput } from "../../helpers/folder-project";
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

export const createProjectViaApi = async (request: APIRequestContext, name: string, folderPath?: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: folderProjectInput({ name }, folderPath) });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string; name: string };
};
