import { describe, expect, test } from "bun:test";
import { l10n } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { readTicketStatuses } from "../../data/status-operations";
import { readTicketTags } from "../../data/tag-operations";
import type { Ticket } from "../../data/types";
import { buildTicketPropertiesControls, type WireParam } from "./params";

const baseTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "t1",
  shorthand: "PS-1",
  title: "Title",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-02T00:00:00.000Z",
  ...overrides,
});

const resourceParam = (params: WireParam[], id: string) => {
  const param = params.find((entry) => entry.id === id);
  if (!param || param.type !== "resource") throw new Error(`Expected resource param "${id}"`);
  return param;
};

const propertyParam = (params: WireParam[], id: string) => {
  const param = params.find((entry) => entry.id === id);
  if (!param || param.type !== "readOnly") throw new Error(`Expected read-only control "${id}"`);
  return param;
};

const seed = async () => {
  const storage = createMemoryStorage();
  const { statuses } = await readTicketStatuses(storage);
  const { tags } = await readTicketTags(storage);
  return { statuses, tags };
};

describe("buildTicketPropertiesControls", () => {
  test("renders the id as a copyable resource chip", async () => {
    const { statuses, tags } = await seed();

    const { params } = buildTicketPropertiesControls({
      ticket: baseTicket({ shorthand: "PS-42" }),
      statuses,
      tags,
    });

    const id = resourceParam(params, "id");
    expect(id.editable).toBeFalsy();
    expect(id.defaultValue).toBe("PS-42");
    expect(id.options[0].copyText).toBe("PS-42");
    expect(id.name).toEqual(l10n("displayMenu.orderingOptions.shorthand", "ID"));
  });

  test("maps status to an editable single-select resource param", async () => {
    const { statuses, tags } = await seed();
    const ticket = baseTicket({ statusId: statuses[0].id });

    const { params, readOnly } = buildTicketPropertiesControls({
      ticket,
      statuses,
      tags,
    });

    const status = resourceParam(params, "status");
    expect(readOnly).toBe(false);
    expect(status.editable).toBe(true);
    expect(status.multiSelect).toBeFalsy();
    expect(status.defaultValue).toBe(statuses[0].id);
    expect(status.options.map((option) => option.id)).toContain(statuses[0].id);
  });

  test("maps a single-select tag to its selected option id via the attribute id", async () => {
    const { statuses, tags } = await seed();
    const priority = tags.find((tag) => tag.id === "default-priority")!;
    const high = priority.options.find((option) => option.id === "default-priority-high")!;
    const ticket = baseTicket({ tags: { [priority.id]: high.id } });

    const { params } = buildTicketPropertiesControls({ ticket, statuses, tags });

    const tagParam = resourceParam(params, "priority");
    expect(tagParam.editable).toBe(true);
    expect(tagParam.multiSelect).toBe(false);
    expect(tagParam.defaultValue).toBe(high.id);
  });

  test("omits review links until a ticket has links to open", async () => {
    const { statuses, tags } = await seed();
    for (const reviewLinks of [undefined, []]) {
      const { params } = buildTicketPropertiesControls({
        ticket: baseTicket({ reviewLinks }),
        statuses,
        tags,
      });
      expect(params.some((param) => param.id === "review-links")).toBe(false);
    }
  });

  test("maps review links to external href chips", async () => {
    const { statuses, tags } = await seed();
    const ticket = baseTicket({
      reviewLinks: [
        {
          id: "r1",
          url: "https://example.com/pr/1",
          provider: "github",
          kind: "pull_request",
          externalId: "1",
          title: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const { params } = buildTicketPropertiesControls({ ticket, statuses, tags });

    const reviewLinks = resourceParam(params, "review-links");
    expect(reviewLinks.editable).toBeFalsy();
    expect(reviewLinks.defaultValue).toEqual(["r1"]);
    expect(reviewLinks.options[0].href).toBe("https://example.com/pr/1");
  });

  test("sends the created and updated timestamps unformatted so the viewer's browser formats them", async () => {
    const { statuses, tags } = await seed();
    const ticket = baseTicket({
      createdAt: "2023-05-06T00:00:00.000Z",
      updatedAt: "2024-07-08T00:00:00.000Z",
    });

    const { params } = buildTicketPropertiesControls({ ticket, statuses, tags });

    expect(params.find((entry) => entry.id === "created")).toEqual({
      id: "created",
      name: l10n("ticketDetail.createdAt", "Created at"),
      type: "date",
      readOnly: true,
      defaultValue: "2023-05-06T00:00:00.000Z",
    });
    expect(params.find((entry) => entry.id === "updated")).toMatchObject({
      type: "date",
      readOnly: true,
      defaultValue: "2024-07-08T00:00:00.000Z",
    });
  });

  test("includes archived and blocked-reason rows only when set", async () => {
    const { statuses, tags } = await seed();

    const withoutFlags = buildTicketPropertiesControls({
      ticket: baseTicket({}),
      statuses,
      tags,
    });
    expect(withoutFlags.params.find((param) => param.id === "archived")).toBeUndefined();
    expect(withoutFlags.params.find((param) => param.id === "blocked-reason")).toBeUndefined();

    const withFlags = buildTicketPropertiesControls({
      ticket: baseTicket({ archived: true, blockedReason: "waiting on review" }),
      statuses,
      tags,
    });
    expect(propertyParam(withFlags.params, "archived").value).toEqual(l10n("ticketDetail.yes", "Yes"));
    expect(propertyParam(withFlags.params, "blocked-reason").value).toBe("waiting on review");
  });
});
