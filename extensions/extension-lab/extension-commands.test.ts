import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("extension-lab commands", () => {
  test("reads command invocation attachment context", async () => {
    const result = await extension.commands?.["say-hello"]?.run(
      {
        attachment: {
          target: "workbench.nav.actions",
          mode: "workspace",
          projectId: "project-1",
          resource: { type: "workspace", id: "workspace-1", label: "Workspace 1" },
        },
        notify: { toast: async () => {} },
        projectId: "project-1",
        settings: {
          get: async (key: string) => {
            if (key === "model.default") return "claude-sonnet-4";
            if (key === "greeting.tone") return "friendly";
            return undefined;
          },
        },
      } as never,
      {},
    );

    expect(result).toMatchObject({
      attachment: {
        target: "workbench.nav.actions",
        mode: "workspace",
        resource: { type: "workspace", id: "workspace-1", label: "Workspace 1" },
      },
      message: "hello dispatched",
      model: "claude-sonnet-4",
      tone: "friendly",
    });
  });

  test("creates, queries, and deletes Glass Lab artifacts", async () => {
    const artifacts = new Map<string, unknown>();
    const emitted: string[] = [];
    const events = {
      emit: async (event: string | { id: string }) => {
        emitted.push(typeof event === "string" ? event : event.id);
        return { delivered: 0 };
      },
    };
    const storage = {
      collection: () => ({
        get: async (id: string) => artifacts.get(id),
        list: async () => [...artifacts.values()],
        put: async (id: string, value: unknown) => {
          artifacts.set(id, value);
        },
        delete: async (id: string) => {
          artifacts.delete(id);
        },
      }),
    };
    const create = extension.commands?.["glass-lab-artifacts.create"];
    const query = extension.commands?.["glass-lab-artifacts.query"];
    const remove = extension.commands?.["glass-lab-artifacts.delete"];

    const [first, second] = await Promise.all([
      create?.run({ events, storage } as never, {}),
      create?.run({ events, storage } as never, {}),
    ]);
    const firstId = first?.id;
    const secondId = second?.id;
    const result = await query?.run({ storage } as never, {});

    expect(first).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      role: expect.any(String),
      trustSignal: expect.any(Number),
      status: expect.any(String),
      summary: expect.any(String),
      custody: expect.any(String),
      nextStep: expect.any(String),
    });
    expect(secondId).not.toBe(firstId);
    expect(result?.rows).toHaveLength(2);
    expect(result?.rows[0]).toMatchObject({
      id: firstId,
      values: {
        artifact: first?.title,
        role: first?.role,
        trustSignal: first?.trustSignal,
        status: first?.status,
      },
      resource: {
        type: "glass-lab-artifact",
        id: firstId,
        label: first?.title,
        metadata: {
          role: first?.role,
          trustSignal: first?.trustSignal,
          status: first?.status,
          summary: first?.summary,
          custody: first?.custody,
          nextStep: first?.nextStep,
        },
      },
    });
    expect(result?.columns).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "role" }), expect.objectContaining({ id: "trustSignal" })]),
    );

    await remove?.run({ events, storage } as never, { rowId: firstId });

    expect((await query?.run({ storage } as never, {}))?.rows.map((row) => row.id)).toEqual([secondId]);
    expect(emitted).toEqual([
      "extension-lab.artifacts.changed",
      "extension-lab.artifacts.changed",
      "extension-lab.artifacts.changed",
    ]);
  });

  test("creates artifacts from the Create artifacts menu", async () => {
    const collections = new Map<string, Map<string, Record<string, unknown>>>();
    const storage = {
      collection: (name: string) => {
        const records = collections.get(name) ?? new Map<string, Record<string, unknown>>();
        collections.set(name, records);
        return {
          get: async (id: string) => records.get(id),
          list: async () => [...records.values()],
          put: async (id: string, value: Record<string, unknown>) => records.set(id, value),
          delete: async (id: string) => records.delete(id),
        };
      },
    };
    const query = extension.commands?.["artifact-menu.query"];
    const update = extension.commands?.["artifact-menu.update"];
    const events = { emit: async () => ({ delivered: 0 }) };

    const menu = await query?.run({} as never, {});
    expect(menu?.groups?.[0]?.params).toEqual([
      expect.objectContaining({
        id: "create",
        type: "actions",
        options: [expect.objectContaining({ id: "random" }), expect.objectContaining({ id: "locked" })],
      }),
    ]);

    const created = await update?.run({ events, storage } as never, { controlId: "create", value: "locked" });
    expect(created).toMatchObject({ status: "locked" });
    expect(collections.get("glass-lab-artifacts")?.size).toBe(1);

    // ParamEditor value-sync calls carry other values and must not create artifacts.
    await update?.run({ events, storage } as never, { controlId: "create", value: null });
    expect(collections.get("glass-lab-artifacts")?.size).toBe(1);
  });

  test("lists cameras as a tree and persists the selection", async () => {
    const collections = new Map<string, Map<string, Record<string, unknown>>>();
    const storage = {
      collection: (name: string) => {
        const records = collections.get(name) ?? new Map<string, Record<string, unknown>>();
        collections.set(name, records);
        return {
          get: async (id: string) => records.get(id),
          list: async () => [...records.values()],
          put: async (id: string, value: Record<string, unknown>) => records.set(id, value),
          delete: async (id: string) => records.delete(id),
        };
      },
    };
    const tree = extension.commands?.["cams.tree"];
    const select = extension.commands?.["cams.select"];
    const current = extension.commands?.["cams.current"];

    const sections = await tree?.run({ storage } as never, {});
    expect(sections?.[0]?.nodes.length).toBeGreaterThan(1);
    expect(sections?.[0]?.nodes[0]).toMatchObject({
      selected: true,
      target: { kind: "command", command: "extension-lab.cams.select" },
    });

    const secondCamId = sections?.[0]?.nodes[1]?.id as string;
    await select?.run({ storage } as never, { camId: secondCamId });

    expect(await current?.run({ storage } as never, {})).toEqual({ camId: secondCamId });
    const reread = await tree?.run({ storage } as never, {});
    expect(reread?.[0]?.nodes.find((node: { id: string }) => node.id === secondCamId)).toMatchObject({
      selected: true,
    });

    await expect(select?.run({ storage } as never, { camId: "missing-cam" })).rejects.toThrow("Unknown camera");
  });

  test("notifies when the awake middleware rejects", async () => {
    const toasts: unknown[] = [];

    const result = await extension.commands?.["demo.try-awaken"]?.run(
      {
        commands: {
          execute: async () => ({
            ok: false,
            status: "rejected",
            code: "sentience_rejected",
            reason: "That artifact remains safely inert.",
          }),
        },
        notify: {
          toast: async (notice) => {
            toasts.push(notice);
          },
        },
      } as never,
      {},
    );

    expect(result).toEqual({ rejected: true, reason: "That artifact remains safely inert." });
    expect(toasts).toEqual([expect.objectContaining({ type: "warning" })]);
  });
});
