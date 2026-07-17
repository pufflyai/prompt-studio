import { describe, expect, test } from "bun:test";
import { createWorkbenchRendererRegistry } from "./renderer-registry";

// Bun's test runtime has no DOM. We model the parent/child API surface the
// registry actually touches: appendChild, removeChild, contains, parentNode.
interface FakeNode {
  parentNode?: FakeNode;
  children: FakeNode[];
  appendChild(child: FakeNode): void;
  removeChild(child: FakeNode): void;
  contains(child: FakeNode): boolean;
}

const createFakeNode = (): FakeNode => {
  const node: FakeNode = {
    children: [],
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = node;
      node.children.push(child);
    },
    removeChild(child) {
      const index = node.children.indexOf(child);
      if (index === -1) return;
      node.children.splice(index, 1);
      if (child.parentNode === node) child.parentNode = undefined;
    },
    contains(child) {
      return node.children.includes(child);
    },
  };
  return node;
};

const createRegistry = () =>
  createWorkbenchRendererRegistry({ createHost: () => createFakeNode() as unknown as HTMLElement });

const fakeClaimInput = (widgetId = "w") =>
  ({
    workbench: {} as never,
    widget: { id: widgetId } as never,
    placement: { widgetId } as never,
    refresh: () => undefined,
  }) as never;

describe("createWorkbenchRendererRegistry", () => {
  test("registers and resolves widget renderers by id", () => {
    const registry = createRegistry();
    const render = () => null;

    registry.registerRenderer({ id: "project.settings", render });

    expect(registry.getRenderer("project.settings")?.render).toBe(render);
  });

  test("allows renderer replacement after dispose", () => {
    const registry = createRegistry();
    const first = registry.registerRenderer({ id: "project.settings", render: () => "first" });

    expect(() => registry.registerRenderer({ id: "project.settings", render: () => "second" })).toThrow(
      "Renderer already registered: project.settings",
    );

    first.dispose();
    registry.registerRenderer({ id: "project.settings", render: () => "second" });

    const renderer = registry.getRenderer("project.settings")!;
    if (renderer.keepAlive) throw new Error("expected non-keepAlive renderer");
    expect(renderer.render({} as never)).toBe("second");
  });

  test("keep-alive renderer registration defers host allocation until a placement claims it", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "chat", keepAlive: true, render: () => null });

    expect(registry.getHost("chat.one")).toBeUndefined();
  });

  test("non keep-alive renderer registration allocates no host", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "foo", render: () => null });

    expect(registry.getHost("foo")).toBeUndefined();
  });

  test("throws when claiming a renderer that is not keep-alive", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "foo", render: () => null });
    const slot = createFakeNode() as unknown as HTMLElement;

    expect(() => registry.claim("foo", "foo.one", slot, fakeClaimInput("foo.one"))).toThrow(
      "Renderer foo is not keep-alive; cannot claim",
    );
  });

  test("throws when claiming an unknown renderer", () => {
    const registry = createRegistry();
    const slot = createFakeNode() as unknown as HTMLElement;

    expect(() => registry.claim("missing", "missing.one", slot, fakeClaimInput("missing.one"))).toThrow(
      "Renderer is not registered: missing",
    );
  });

  test("claim parents the host into the slot and stores the claim input", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "chat", keepAlive: true, render: () => null });

    const slot = createFakeNode() as unknown as HTMLElement;
    const claimInput = fakeClaimInput("chat.one");
    registry.claim("chat", "chat.one", slot, claimInput);

    const host = registry.getHost("chat.one")!;
    expect((slot as unknown as FakeNode).children).toContain(host as unknown as FakeNode);
    expect(registry.getClaim("chat.one")).toBe(claimInput);
  });

  test("claim moves one placement host across slots without remounting it", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "chat", keepAlive: true, render: () => null });

    const slotA = createFakeNode() as unknown as HTMLElement;
    const slotB = createFakeNode() as unknown as HTMLElement;
    const inputA = fakeClaimInput("chat.one");
    const inputB = fakeClaimInput("chat.one");

    registry.claim("chat", "chat.one", slotA, inputA);
    const hostBeforeMove = registry.getHost("chat.one")!;
    registry.claim("chat", "chat.one", slotB, inputB);
    const hostAfterMove = registry.getHost("chat.one")!;

    expect(hostAfterMove).toBe(hostBeforeMove);
    expect((slotA as unknown as FakeNode).children).not.toContain(hostAfterMove as unknown as FakeNode);
    expect((slotB as unknown as FakeNode).children).toContain(hostAfterMove as unknown as FakeNode);
    expect(registry.getClaim("chat.one")).toBe(inputB);
  });

  test("keeps simultaneous placements of one renderer mounted independently", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "chat", keepAlive: true, render: () => null });

    const slotA = createFakeNode() as unknown as HTMLElement;
    const slotB = createFakeNode() as unknown as HTMLElement;
    const inputA = fakeClaimInput("chat.one");
    const inputB = fakeClaimInput("chat.two");

    registry.claim("chat", "chat.one", slotA, inputA);
    registry.claim("chat", "chat.two", slotB, inputB);

    expect((slotA as unknown as FakeNode).children).toEqual([registry.getHost("chat.one") as unknown as FakeNode]);
    expect((slotB as unknown as FakeNode).children).toEqual([registry.getHost("chat.two") as unknown as FakeNode]);
    expect(registry.getHost("chat.two")).not.toBe(registry.getHost("chat.one"));
    expect(registry.getClaim("chat.one")).toBe(inputA);
    expect(registry.getClaim("chat.two")).toBe(inputB);
  });

  test("re-claim with the same slot only updates the claim input", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "chat", keepAlive: true, render: () => null });

    const slot = createFakeNode() as unknown as HTMLElement;
    const firstInput = fakeClaimInput("chat.one");
    const secondInput = fakeClaimInput("chat.one");

    registry.claim("chat", "chat.one", slot, firstInput);
    const host = registry.getHost("chat.one")!;
    registry.claim("chat", "chat.one", slot, secondInput);

    expect((slot as unknown as FakeNode).children).toEqual([host as unknown as FakeNode]);
    expect(registry.getClaim("chat.one")).toBe(secondInput);
  });

  test("re-claim with unchanged input does not notify renderer consumers", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "chat", keepAlive: true, render: () => null });

    const slot = createFakeNode() as unknown as HTMLElement;
    const claimInput = fakeClaimInput("chat.one");
    registry.claim("chat", "chat.one", slot, claimInput);
    let notifications = 0;
    const unsubscribe = registry.store.subscribe(() => {
      notifications += 1;
    });

    registry.claim("chat", "chat.one", slot, claimInput);

    expect(notifications).toBe(0);
    unsubscribe();
  });

  test("disposing the claim detaches the host and clears the claim input", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "chat", keepAlive: true, render: () => null });

    const slot = createFakeNode() as unknown as HTMLElement;
    const disposable = registry.claim("chat", "chat.one", slot, fakeClaimInput("chat.one"));
    disposable.dispose();

    expect((slot as unknown as FakeNode).children).toEqual([]);
    expect(registry.getClaim("chat.one")).toBeUndefined();
  });

  test("re-claim makes the previous claim's disposable a no-op", () => {
    const registry = createRegistry();
    registry.registerRenderer({ id: "chat", keepAlive: true, render: () => null });

    const slotA = createFakeNode() as unknown as HTMLElement;
    const slotB = createFakeNode() as unknown as HTMLElement;

    const firstClaim = registry.claim("chat", "chat.one", slotA, fakeClaimInput("chat.one"));
    registry.claim("chat", "chat.one", slotB, fakeClaimInput("chat.one"));
    firstClaim.dispose();

    expect((slotB as unknown as FakeNode).children).toHaveLength(1);
    expect(registry.getClaim("chat.one")).toBeDefined();
  });

  test("disposing a keep-alive registration removes its host and claim", () => {
    const registry = createRegistry();
    const registration = registry.registerRenderer({ id: "chat", keepAlive: true, render: () => null });

    const slot = createFakeNode() as unknown as HTMLElement;
    registry.claim("chat", "chat.one", slot, fakeClaimInput("chat.one"));
    registration.dispose();

    expect(registry.getHost("chat.one")).toBeUndefined();
    expect(registry.getClaim("chat.one")).toBeUndefined();
    expect((slot as unknown as FakeNode).children).toEqual([]);
  });
});
