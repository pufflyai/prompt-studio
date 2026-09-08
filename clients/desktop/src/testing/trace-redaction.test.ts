import { expect, test } from "bun:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { redactTraceArchive } from "./trace-redaction";

test("removes runtime credentials from every trace entry while preserving the archive", () => {
  const cookieToken = "runtime-cookie-secret";
  const bearerToken = "runtime-bearer-secret";
  const pixels = new Uint8Array([137, 80, 78, 71, 255, 0]);
  const archive = zipSync({
    "trace.network": strToU8(
      JSON.stringify({ request: { headers: [{ name: "Cookie", value: `pstdio_runtime_session=${cookieToken}` }] } }),
    ),
    "trace.trace": strToU8(
      [
        { result: { cookies: [{ name: "pstdio_runtime_session", value: cookieToken }] } },
        { request: { headers: [{ name: "Authorization", value: `Bearer ${bearerToken}` }] } },
        { params: { expected: cookieToken, actual: bearerToken } },
      ]
        .map((event) => JSON.stringify(event))
        .join("\n"),
    ),
    "resources/response": strToU8(JSON.stringify({ token: cookieToken, message: "Ready" })),
    "resources/screenshot.png": pixels,
  });
  const entries = unzipSync(redactTraceArchive(archive));
  for (const [name, contents] of Object.entries(entries)) {
    if (name.endsWith(".png")) continue;
    expect(strFromU8(contents)).not.toContain(cookieToken);
    expect(strFromU8(contents)).not.toContain(bearerToken);
  }
  expect(JSON.parse(strFromU8(entries["resources/response"]!))).toMatchObject({ message: "Ready" });
  expect(entries["resources/screenshot.png"]).toEqual(pixels);
});
