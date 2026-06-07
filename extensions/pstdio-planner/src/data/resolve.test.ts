import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "./collections";
import { createMemoryStorage } from "./memory-storage";
import { resolveStatusId, resolveTagId, resolveTagOptionIds, resolveTicketId } from "./resolve";
import { seedDefaultStatuses, seedDefaultTags } from "./seed";

describe("resolveStatusId", () => {
  test("resolves by id and by case-insensitive name", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);

    expect(await resolveStatusId(storage, "default-ready")).toBe("default-ready");
    expect(await resolveStatusId(storage, "in progress")).toBe("default-in-progress");
  });

  test("throws a clear error for an unknown status", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);

    await expect(resolveStatusId(storage, "nope")).rejects.toThrow(/Unknown status "nope"/);
  });
});

describe("resolveTagId", () => {
  test("resolves a tag definition by name", async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);

    expect(await resolveTagId(storage, "Priority")).toBe("default-priority");
  });
});

describe("resolveTagOptionIds", () => {
  test("maps option names to ids across tags", async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);

    expect(await resolveTagOptionIds(storage, ["High", "Bug"])).toEqual(["default-priority-high", "default-type-bug"]);
  });

  test("throws for an unknown option", async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);

    await expect(resolveTagOptionIds(storage, ["ghost"])).rejects.toThrow(/Unknown tag option "ghost"/);
  });
});

describe("resolveTicketId", () => {
  test("resolves by shorthand and id", async () => {
    const storage = createMemoryStorage();
    await ticketsCollection(storage).put("t1", {
      id: "t1",
      shorthand: "T-1",
      title: "First",
      content: "",
      statusId: null,
      archived: false,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
    });

    expect(await resolveTicketId(storage, "T-1")).toBe("t1");
    expect(await resolveTicketId(storage, "t1")).toBe("t1");
  });
});
