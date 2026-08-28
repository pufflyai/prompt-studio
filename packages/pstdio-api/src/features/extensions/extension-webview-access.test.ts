import { describe, expect, test } from "bun:test";
import { createExtensionWebviewAccess } from "./extension-webview-access";

const createAccess = () =>
  createExtensionWebviewAccess({
    signingKey: Buffer.from("test-webview-signing-key"),
  });

const scope = { installName: "extension-lab", webviewId: "lab.page" };

describe("extension webview access", () => {
  test("issues and authorizes read-only URLs for one webview scope", () => {
    const access = createAccess();
    const runtimeUrl = access.runtimeUrl(scope);
    const assetUrl = access.assetUrl(scope, "chunks/view.js", "build-2");

    expect(runtimeUrl).toMatch(/^\/v1\/extensions\/webviews\/[A-Za-z0-9_-]+\/extension-lab\/lab\.page\/runtime$/);
    expect(assetUrl).toBe(`${runtimeUrl.replace(/\/runtime$/, "")}/assets/chunks/view.js?h=build-2`);

    expect(access.authorize(new Request(`http://127.0.0.1:43123${runtimeUrl}`))).toEqual({
      installName: "extension-lab",
      kind: "runtime",
      webviewId: "lab.page",
    });
    expect(access.authorize(new Request(`http://127.0.0.1:43123${assetUrl}`))).toEqual({
      assetPath: "chunks/view.js",
      installName: "extension-lab",
      kind: "asset",
      webviewId: "lab.page",
    });

    expect(
      access.authorize(
        new Request(`http://127.0.0.1:43123${runtimeUrl}`, {
          method: "HEAD",
        }),
      ),
    ).not.toBeNull();
    expect(
      access.authorize(
        new Request(`http://127.0.0.1:43123${runtimeUrl}`, {
          method: "POST",
        }),
      ),
    ).toBeNull();
  });

  test("rejects altered scopes and capabilities from another runtime instance", () => {
    const first = createAccess();
    const second = createExtensionWebviewAccess({
      signingKey: Buffer.from("replacement-runtime-key"),
    });
    const runtimeUrl = first.runtimeUrl(scope);
    const alteredScopeUrl = runtimeUrl.replace("/lab.page/", "/other.page/");

    expect(first.authorize(new Request(`http://127.0.0.1:43123${alteredScopeUrl}`))).toBeNull();
    expect(second.authorize(new Request(`http://127.0.0.1:43123${runtimeUrl}`))).toBeNull();
  });

  test("issues expiring, fully-bound artifact URLs", () => {
    let clock = 1_000_000_000_000;
    const access = createExtensionWebviewAccess({
      signingKey: Buffer.from("test-webview-signing-key"),
      now: () => clock,
    });
    const request = { projectId: "project-1", mountId: "runs", artifactPath: "a/chart.png" };
    const artifactUrl = access.artifactUrl(scope, request);

    expect(artifactUrl).toMatch(
      /^\/v1\/extensions\/webviews\/[A-Za-z0-9_-]+\/extension-lab\/lab\.page\/artifacts\/\d+\/project-1\/runs\/a\/chart\.png$/,
    );
    expect(access.authorize(new Request(`http://127.0.0.1:43123${artifactUrl}`))).toEqual({
      artifactPath: "a/chart.png",
      installName: "extension-lab",
      kind: "artifact",
      mountId: "runs",
      projectId: "project-1",
      webviewId: "lab.page",
    });

    // Every signed part is tamper-proof: mount, path, project, and expiry.
    for (const altered of [
      artifactUrl.replace("/runs/", "/secrets/"),
      artifactUrl.replace("chart.png", "other.png"),
      artifactUrl.replace("project-1", "project-2"),
      artifactUrl.replace(/artifacts\/\d+\//, "artifacts/9999999999/"),
    ]) {
      expect(access.authorize(new Request(`http://127.0.0.1:43123${altered}`))).toBeNull();
    }

    // A webview asset capability never authorizes artifact reads.
    const assetCapability = access.assetUrl(scope, "module.js").split("/")[4]!;
    const forged = artifactUrl.replace(/webviews\/[A-Za-z0-9_-]+\//, `webviews/${assetCapability}/`);
    expect(access.authorize(new Request(`http://127.0.0.1:43123${forged}`))).toBeNull();

    clock += 11 * 60 * 1000;
    expect(access.authorize(new Request(`http://127.0.0.1:43123${artifactUrl}`))).toBeNull();
  });

  test("redacts a capability wherever its path appears", () => {
    const access = createAccess();
    const assetUrl = access.assetUrl(scope, "module.js");
    const redactedPath = "/v1/extensions/webviews/[Redacted]/extension-lab/lab.page/assets/module.js";

    expect(access.redactPath(assetUrl)).toBe(redactedPath);
    expect(access.redactPath(`failed to load http://127.0.0.1:43123${assetUrl}`)).toBe(
      `failed to load http://127.0.0.1:43123${redactedPath}`,
    );
  });
});
