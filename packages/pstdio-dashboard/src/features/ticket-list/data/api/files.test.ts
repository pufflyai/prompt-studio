import { afterEach, describe, expect, it, mock } from "bun:test";

import { getTicketFileContent, getTicketFiles, uploadTicketFile } from "./files";

const originalFetch = globalThis.fetch;

const createdAt = "2026-06-08T10:00:00.000Z";
const updatedAt = "2026-06-08T10:05:00.000Z";

const ticketWithAttachments = {
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "Ticket body",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt,
  updatedAt,
  files: [{ id: "file-1", name: "notes.md", content: "hello", createdAt, updatedAt }],
  attachments: [
    {
      id: "att-image",
      name: "diagram.png",
      mimeType: "image/png",
      size: 8,
      hash: "hash-image",
      url: "/v1/projects/project-1/extensions/instance-1/files/att-image/content",
      createdAt,
      updatedAt,
    },
    {
      id: "att-pdf",
      name: "spec.pdf",
      mimeType: "application/pdf",
      size: 12,
      hash: "hash-pdf",
      url: "/v1/projects/project-1/extensions/instance-1/files/att-pdf/content",
      createdAt,
      updatedAt,
    },
  ],
};

const plannerResponse = (value: unknown) =>
  new Response(JSON.stringify({ outcome: { ok: true, status: "success", value } }), { status: 200 });

const bodyAsJson = (body: BodyInit | null | undefined) => JSON.parse(String(body));

const bodyAsBytes = async (body: BodyInit | null | undefined) => {
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  return new Uint8Array(await new Response(body).arrayBuffer());
};

describe("ticket file api", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("includes image attachments from planner tickets", async () => {
    globalThis.fetch = mock(async () => plannerResponse(ticketWithAttachments)) as unknown as typeof fetch;

    await expect(getTicketFiles("project-1", "ticket-1")).resolves.toEqual({
      files: [
        {
          id: "file-1",
          file_name: "notes.md",
          file_kind: "ticket",
          mime_type: "text/markdown",
          size_bytes: 5,
          created_at: createdAt,
        },
        {
          id: "att-image",
          file_name: "diagram.png",
          file_kind: "ticket-attachment",
          mime_type: "image/png",
          size_bytes: 8,
          created_at: createdAt,
        },
      ],
      artifacts: [],
    });
  });

  it("reads image attachment content through the planner attachment command", async () => {
    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/projects/project-1/extensions/commands/pstdio-planner.get-ticket/execute")) {
        return plannerResponse(ticketWithAttachments);
      }
      if (url.endsWith("/v1/projects/project-1/extensions/commands/pstdio-planner.read-ticket-attachment/execute")) {
        expect(bodyAsJson(init?.body).params).toEqual({ ticketId: "ticket-1", attachmentId: "att-image" });
        return plannerResponse({ dataUrl: "data:image/png;base64,iVBORw0KGgo=" });
      }
      return plannerResponse(null);
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(getTicketFileContent("project-1", "ticket-1", "att-image")).resolves.toBe(
      "data:image/png;base64,iVBORw0KGgo=",
    );
  });

  it("uploads binary files as planner attachments instead of editable text files", async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const uploadedBodies: Uint8Array[] = [];
    const attachedRefs: unknown[] = [];

    const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/projects/project-1/extensions")) {
        return new Response(
          JSON.stringify({
            extensions: [{ id: "instance-1", installName: "pstdio-planner", enabled: true }],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/v1/projects/project-1/extensions/instance-1/files?scope_type=resource&scope_id=ticket-1")) {
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>)["content-type"]).toBe("image/png");
        expect((init?.headers as Record<string, string>)["x-file-name"]).toBe("diagram.png");
        uploadedBodies.push(await bodyAsBytes(init?.body));
        return new Response(
          JSON.stringify({
            id: "att-image",
            name: "diagram.png",
            mimeType: "image/png",
            size: imageBytes.byteLength,
            hash: "hash-image",
            url: "/v1/projects/project-1/extensions/instance-1/files/att-image/content",
            createdAt,
            updatedAt,
          }),
          { status: 201 },
        );
      }
      if (url.endsWith("/v1/projects/project-1/extensions/commands/pstdio-planner.attach-file/execute")) {
        const params = bodyAsJson(init?.body).params;
        attachedRefs.push(params.ref);
        return plannerResponse(ticketWithAttachments);
      }
      if (url.includes("/extensions/commands/pstdio-planner.create-ticket-file/execute")) {
        return plannerResponse({ id: "wrong-text-file", name: "diagram.png" });
      }
      if (url.includes("/extensions/commands/pstdio-planner.update-ticket-file/execute")) {
        return plannerResponse({ id: "wrong-text-file", name: "diagram.png" });
      }
      return plannerResponse({ ...ticketWithAttachments, files: [], attachments: [] });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await uploadTicketFile("project-1", "ticket-1", new File([imageBytes], "diagram.png", { type: "image/png" }));

    expect(uploadedBodies).toEqual([imageBytes]);
    expect(attachedRefs).toEqual([
      {
        id: "att-image",
        name: "diagram.png",
        mimeType: "image/png",
        size: imageBytes.byteLength,
        hash: "hash-image",
        url: "/v1/projects/project-1/extensions/instance-1/files/att-image/content",
        createdAt,
        updatedAt,
      },
    ]);
  });

  it("rejects unsupported file types instead of silently storing them", async () => {
    const fetchMock = mock(async () => {
      throw new Error("network must not be called for unsupported uploads");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      uploadTicketFile(
        "project-1",
        "ticket-1",
        new File([new Uint8Array([1, 2, 3])], "spec.pdf", { type: "application/pdf" }),
      ),
    ).rejects.toThrow(/unsupported file type/i);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
