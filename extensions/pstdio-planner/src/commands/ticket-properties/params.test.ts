import { describe, expect, test } from "bun:test";
import { l10n } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "../../data/memory-storage";
import { readTicketStatuses } from "../../data/status-operations";
import { readTicketTags } from "../../data/tag-operations";
import type { StoredTicket } from "../../data/types";
import { buildTicketPropertiesControls, type WireParam } from "./params";

const baseTicket = (overrides: Partial<StoredTicket>): StoredTicket => ({
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
  if (!param || param.type !== "property") throw new Error(`Expected property param "${id}"`);
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
      dependencies: [],
      parent: null,
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
      dependencies: [],
      parent: null,
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
    const ticket = baseTicket({ tagIds: [high.id] });

    const { params } = buildTicketPropertiesControls({ ticket, statuses, tags, dependencies: [], parent: null });

    const tagParam = resourceParam(params, "priority");
    expect(tagParam.editable).toBe(true);
    expect(tagParam.multiSelect).toBe(false);
    expect(tagParam.defaultValue).toBe(high.id);
  });

  test("renders parent and dependencies as view-only chips that open their ticket", async () => {
    const { statuses, tags } = await seed();
    const ticket = baseTicket({ parentId: "p1", dependsOn: ["d1", "d2"] });

    const { params } = buildTicketPropertiesControls({
      ticket,
      statuses,
      tags,
      dependencies: [
        { id: "d1", label: "PS-2" },
        { id: "d2", label: "PS-3" },
      ],
      parent: { id: "p1", label: "PS-9" },
    });

    const dependsOn = resourceParam(params, "depends-on");
    expect(dependsOn.editable).toBeFalsy();
    expect(dependsOn.multiSelect).toBe(true);
    expect(dependsOn.defaultValue).toEqual(["d1", "d2"]);
    expect(dependsOn.options[0].ref).toEqual({ type: "ticket", id: "d1" });

    const parent = resourceParam(params, "parent");
    expect(parent.defaultValue).toBe("p1");
    expect(parent.options[0].ref).toEqual({ type: "ticket", id: "p1" });
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

    const { params } = buildTicketPropertiesControls({ ticket, statuses, tags, dependencies: [], parent: null });

    const reviewLinks = resourceParam(params, "review-links");
    expect(reviewLinks.editable).toBeFalsy();
    expect(reviewLinks.defaultValue).toEqual(["r1"]);
    expect(reviewLinks.options[0].href).toBe("https://example.com/pr/1");
  });

  test("includes archived and blocked-reason rows only when set", async () => {
    const { statuses, tags } = await seed();

    const withoutFlags = buildTicketPropertiesControls({
      ticket: baseTicket({}),
      statuses,
      tags,
      dependencies: [],
      parent: null,
    });
    expect(withoutFlags.params.find((param) => param.id === "archived")).toBeUndefined();
    expect(withoutFlags.params.find((param) => param.id === "blocked-reason")).toBeUndefined();

    const withFlags = buildTicketPropertiesControls({
      ticket: baseTicket({ archived: true, blockedReason: "waiting on review" }),
      statuses,
      tags,
      dependencies: [],
      parent: null,
    });
    expect(propertyParam(withFlags.params, "archived").value).toEqual(l10n("ticketDetail.yes", "Yes"));
    expect(propertyParam(withFlags.params, "blocked-reason").value).toBe("waiting on review");
  });
});
