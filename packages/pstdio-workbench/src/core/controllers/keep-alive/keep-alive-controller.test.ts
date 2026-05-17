import { describe, expect, test } from "bun:test";
import { createKeepAliveController } from "./keep-alive-controller";

// Bun's test runtime has no DOM. We model the parent/child API surface the
// controller actually touches: appendChild, removeChild, contains, parentNode.
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

const createController = () =>
  createKeepAliveController({ createHost: () => createFakeNode() as unknown as HTMLElement });

describe("createKeepAliveController", () => {
  test("registers and lists keep-alive subtrees", () => {
    const controller = createController();
    const disposable = controller.register({ id: "chat", render: () => null });

    expect(controller.listRegistrations().map((entry) => entry.id)).toEqual(["chat"]);
    disposable.dispose();
    expect(controller.listRegistrations()).toEqual([]);
  });

  test("throws on duplicate id", () => {
    const controller = createController();
    controller.register({ id: "chat", render: () => null });
    expect(() => controller.register({ id: "chat", render: () => null })).toThrow(
      "Keep-alive id already registered: chat",
    );
  });

  test("throws when claiming an unknown id", () => {
    const controller = createController();
    const slot = createFakeNode() as unknown as HTMLElement;
    expect(() => controller.claim("missing", slot)).toThrow("Keep-alive id not registered: missing");
  });

  test("claim parents the host element into the slot and fires onAttach", () => {
    const controller = createController();
    const attached: HTMLElement[] = [];
    controller.register({
      id: "chat",
      render: () => null,
      onAttach: (host) => attached.push(host),
    });

    const slotA = createFakeNode() as unknown as HTMLElement;
    controller.claim("chat", slotA);

    const host = controller.getHost("chat")!;
    expect(controller.getAttachedSlot("chat")).toBe(slotA);
    expect((slotA as unknown as FakeNode).children).toContain(host as unknown as FakeNode);
    expect(attached).toEqual([host]);
  });

  test("claim moves the same host element across slots (DOM identity preserved)", () => {
    const controller = createController();
    const detached: HTMLElement[] = [];
    const attached: HTMLElement[] = [];
    controller.register({
      id: "chat",
      render: () => null,
      onAttach: (host) => attached.push(host),
      onDetach: (host) => detached.push(host),
    });

    const slotA = createFakeNode() as unknown as HTMLElement;
    const slotB = createFakeNode() as unknown as HTMLElement;

    controller.claim("chat", slotA);
    const hostAfterFirstClaim = controller.getHost("chat")!;
    controller.claim("chat", slotB);
    const hostAfterSecondClaim = controller.getHost("chat")!;

    expect(hostAfterSecondClaim).toBe(hostAfterFirstClaim);
    expect((slotA as unknown as FakeNode).children).not.toContain(hostAfterSecondClaim as unknown as FakeNode);
    expect((slotB as unknown as FakeNode).children).toContain(hostAfterSecondClaim as unknown as FakeNode);
    expect(detached).toEqual([hostAfterFirstClaim]);
    expect(attached).toEqual([hostAfterFirstClaim, hostAfterSecondClaim]);
  });

  test("disposing the claim detaches the host from its slot", () => {
    const controller = createController();
    controller.register({ id: "chat", render: () => null });

    const slot = createFakeNode() as unknown as HTMLElement;
    const claimDisposable = controller.claim("chat", slot);
    claimDisposable.dispose();

    expect((slot as unknown as FakeNode).children).toEqual([]);
    expect(controller.getAttachedSlot("chat")).toBeUndefined();
  });

  test("re-claim makes the previous claim's disposable a no-op", () => {
    const controller = createController();
    controller.register({ id: "chat", render: () => null });

    const slotA = createFakeNode() as unknown as HTMLElement;
    const slotB = createFakeNode() as unknown as HTMLElement;

    const firstClaim = controller.claim("chat", slotA);
    controller.claim("chat", slotB);
    firstClaim.dispose();

    // The first claim's disposable saw slotA but the host is now in slotB.
    // Disposing it must not detach the active slot.
    expect(controller.getAttachedSlot("chat")).toBe(slotB);
    expect((slotB as unknown as FakeNode).children).toHaveLength(1);
  });

  test("disposing the registration detaches the host and fires onDispose", () => {
    const controller = createController();
    let disposed = false;
    const detached: HTMLElement[] = [];

    const registration = controller.register({
      id: "chat",
      render: () => null,
      onDetach: (host) => detached.push(host),
      onDispose: () => {
        disposed = true;
      },
    });

    const slot = createFakeNode() as unknown as HTMLElement;
    controller.claim("chat", slot);
    const host = controller.getHost("chat")!;
    registration.dispose();

    expect(disposed).toBe(true);
    expect(detached).toEqual([host]);
    expect(controller.listRegistrations()).toEqual([]);
    expect((slot as unknown as FakeNode).children).toEqual([]);
  });
});
