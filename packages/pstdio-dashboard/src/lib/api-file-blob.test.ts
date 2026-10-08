import { expect, test } from "bun:test";
import { safeApiFileBlob } from "./api-file-blob";

test("opens active attachment content as a download instead of a dashboard-origin document", async () => {
  for (const type of ["text/html", "image/svg+xml", "application/xhtml+xml"]) {
    const blob = new Blob(["<script>localStorage.getItem('pstdio.browserSession')</script>"], { type });
    const safe = safeApiFileBlob(blob);
    expect(safe.type).toBe("application/octet-stream");
    expect(await safe.text()).toBe(await blob.text());
  }
});

test("keeps safe image previews and plain text readable", () => {
  for (const type of ["image/png", "image/jpeg", "image/gif", "text/plain"]) {
    const blob = new Blob(["content"], { type });
    expect(safeApiFileBlob(blob).type).toBe(blob.type);
  }
});
