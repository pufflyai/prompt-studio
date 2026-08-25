import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { linkReviewCommand } from "./link-review";

describe("link review command", () => {
  test("stores GitHub pull request metadata", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Add feature" } }));

    const updated = await linkReviewCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.shorthand, url: "https://github.com/org/repo/pull/456" },
      }),
    );

    expect(updated.reviewLinks).toHaveLength(1);
    expect(updated.reviewLinks?.[0]).toMatchObject({
      url: "https://github.com/org/repo/pull/456",
      provider: "github",
      kind: "pull_request",
      externalId: "456",
      title: null,
    });
    expect(updated.reviewLinks?.[0]?.id).toEqual(expect.any(String));
    expect(updated.reviewLinks?.[0]?.createdAt).toEqual(expect.any(String));
    expect(updated.reviewLinks?.[0]?.updatedAt).toEqual(expect.any(String));

    const persisted = await ticketsCollection(storage).get(ticket.id);
    expect(persisted?.reviewLinks?.[0]?.externalId).toBe("456");
  });

  test("stores GitLab merge request metadata", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Add feature" } }));

    const updated = await linkReviewCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id, url: "https://gitlab.com/org/repo/-/merge_requests/456", title: "Review changes" },
      }),
    );

    expect(updated.reviewLinks?.[0]).toMatchObject({
      url: "https://gitlab.com/org/repo/-/merge_requests/456",
      provider: "gitlab",
      kind: "merge_request",
      externalId: "456",
      title: "Review changes",
    });
  });

  test("stores unknown URLs as generic review links", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Add feature" } }));

    const updated = await linkReviewCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.shorthand, url: "https://example.com/reviews/abc" },
      }),
    );

    expect(updated.reviewLinks?.[0]).toMatchObject({
      url: "https://example.com/reviews/abc",
      provider: "unknown",
      kind: "review",
      externalId: null,
      title: null,
    });
  });

  test("appends multiple review links", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Add feature" } }));

    await linkReviewCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id, url: "https://github.com/org/repo/pull/456" },
      }),
    );
    const updated = await linkReviewCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id, url: "https://gitlab.com/org/repo/-/merge_requests/789" },
      }),
    );

    expect(updated.reviewLinks?.map((link) => link.externalId)).toEqual(["456", "789"]);
  });

  test("throws for an unknown ticket", async () => {
    const storage = createMemoryStorage();

    await expect(
      linkReviewCommand.run(
        ...makeCommandArgs({
          storage,
          params: { id: "missing", url: "https://github.com/org/repo/pull/456" },
        }),
      ),
    ).rejects.toThrow(/Unknown ticket "missing"/);
  });
});
