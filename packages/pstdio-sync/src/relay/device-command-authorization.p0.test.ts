import { expect, test } from "bun:test";
import { createDeviceCommandAuthorization } from "./device-command-authorization";

test("one-use target authorizations bind the caller and accept only ordered chunks", () => {
  const grants = createDeviceCommandAuthorization();
  try {
    const { challenge } = grants.issue("laptop");
    expect(() => grants.append("stranger", challenge, 0, new Uint8Array([1]), true)).toThrow();
    expect(grants.append("laptop", challenge, 0, new Uint8Array([1, 2]), false)).toMatchObject({ received: 2 });
    expect(() => grants.append("laptop", challenge, 0, new Uint8Array([1, 2]), false)).toThrow("out of order");
    expect(() => grants.append("laptop", challenge, 2, new Uint8Array(), false)).toThrow("must not be empty");
    expect(grants.append("laptop", challenge, 2, new Uint8Array([3]), true)).toEqual({
      complete: true,
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(() => grants.append("laptop", challenge, 2, new Uint8Array([3]), true)).toThrow("already used");
  } finally {
    grants.clear();
  }
});

test("all incomplete device calls share a byte bound and connection cleanup releases it", () => {
  const grants = createDeviceCommandAuthorization();
  try {
    const first = grants.issue("laptop");
    grants.append("laptop", first.challenge, 0, new Uint8Array(64 * 1024 * 1024), false);
    const second = grants.issue("desktop");
    expect(() => grants.append("desktop", second.challenge, 0, new Uint8Array([1]), false)).toThrow("transfer memory");
    grants.clear();
    expect(() => grants.append("laptop", first.challenge, 64 * 1024 * 1024, new Uint8Array(), true)).toThrow();
    const fresh = grants.issue("desktop");
    expect(grants.append("desktop", fresh.challenge, 0, new Uint8Array([2]), true)).toMatchObject({ complete: true });
  } finally {
    grants.clear();
  }
});
