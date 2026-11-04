import type { PstdioClient } from "@pstdio/sdk/client";
import { createTextEditingClient } from "@pstdio/sdk/extensions";
import { expect } from "../scripts/playwright-test";

/** The authenticated agent gets the same selected-source boundary, not a fixture-only session. */
export const appendAgentText = async (client: PstdioClient, projectId: string, suffix: string) => {
  const connection = await client.textEditing.connect({
    projectId,
    scope: {
      kind: "agent",
      target: {
        extensionId: "paper.public-text-source",
        textDocument: { sourceId: "body", params: {} },
      },
    },
  });
  const guest = connection.guest();
  try {
    const text = createTextEditingClient(guest.host);
    const grant = await text.current();
    expect(grant).toBeDefined();
    await expect(text.open({ sourceId: "private-body", params: {} })).rejects.toMatchObject({ code: "grant_invalid" });
    const session = await text.open({ grant: grant! });
    try {
      session.transact((value) => value.insert(value.length, suffix));
      await session.flush();
      await session.project();
    } finally {
      await session.close();
    }
  } finally {
    await guest.close();
  }
};
