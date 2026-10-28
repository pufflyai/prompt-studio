import { expect } from "bun:test";

export const expectPackagedOnboarding = async (baseUrl: string, headers: Record<string, string>) => {
  const update = (body: unknown) =>
    fetch(`${baseUrl}/v1/onboarding`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const hidden = await update({ step: "visibility", hidden: true });
  expect(hidden.status).toBe(200);
  expect(await hidden.json()).toMatchObject({ hidden: true, completed: false });
  const skipped = await update({ step: "skip" });
  expect(skipped.status).toBe(200);
  expect(await skipped.json()).toMatchObject({ completed: true, harnesses: null, workAreas: null });
  const saved = await fetch(`${baseUrl}/v1/onboarding`, { headers });
  expect(saved.status).toBe(200);
  expect((await saved.json()).state).toMatchObject({ hidden: true, completed: true });
  const jobs = await fetch(`${baseUrl}/v1/extension-installations`, { headers });
  expect(jobs.status).toBe(200);
  expect(Array.isArray(await jobs.json())).toBe(true);
};
