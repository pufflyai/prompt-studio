import { expect, test } from "bun:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { redactTraceArchive } from "./trace-redaction";

test("removes runtime credentials from every trace entry while preserving the archive", () => {
  const browserSecret = "browser-session-secret";
  const bearerToken = "runtime-bearer-secret";
  const pixels = new Uint8Array([137, 80, 78, 71, 255, 0]);
  const archive = zipSync({
    "trace.network": strToU8(
      JSON.stringify({
        request: { headers: [{ name: "Sec-WebSocket-Protocol", value: `pstdio, pstdio.bearer.${browserSecret}` }] },
      }),
    ),
    "trace.trace": strToU8(
      [
        { request: { headers: [{ name: "Authorization", value: `Bearer ${bearerToken}` }] } },
        { params: { expected: browserSecret, actual: bearerToken } },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n"),
    ),
    "resources/session": strToU8(JSON.stringify({ secret: browserSecret })),
    "resources/response": strToU8(JSON.stringify({ token: browserSecret, message: "Ready" })),
    "resources/screenshot.png": pixels,
  });
  const entries = unzipSync(redactTraceArchive(archive));
  for (const [name, contents] of Object.entries(entries)) {
    if (name.endsWith(".png")) continue;
    expect(strFromU8(contents)).not.toContain(browserSecret);
    expect(strFromU8(contents)).not.toContain(bearerToken);
  }
  expect(JSON.parse(strFromU8(entries["resources/response"]!))).toMatchObject({ message: "Ready" });
  expect(entries["resources/screenshot.png"]).toEqual(pixels);
});
