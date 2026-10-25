import { describe, expect, test } from "bun:test";
import {
  buildFriendlyJsonParams,
  buildJsonFields,
  getJsonCellSummary,
  isJsonImageArray,
  isJsonImageValue,
  parseJsonCellValue,
} from "./friendly-json-display";

describe("friendly JSON values", () => {
  test("parses JSON strings and preserves ordinary text", () => {
    expect(parseJsonCellValue('{"customer":{"firstName":"Mina"}}')).toEqual({
      customer: { firstName: "Mina" },
    });
    expect(parseJsonCellValue("Not JSON")).toBe("Not JSON");
  });

  test("flattens nested values into human-readable fields", () => {
    expect(
      buildJsonFields({
        customer: { firstName: "Mina", email_address: "mina@example.com" },
        preferences: { newsletter: true },
        interests: ["Design", "Travel"],
      }),
    ).toEqual([
      { label: "Customer / First name", value: "Mina" },
      { label: "Customer / Email address", value: "mina@example.com" },
      { label: "Preferences / Newsletter", value: true },
      { label: "Interests", value: ["Design", "Travel"] },
    ]);
  });

  test("numbers entries in arrays of objects", () => {
    expect(buildJsonFields({ contacts: [{ name: "Ari" }, { name: "Bo" }] })).toEqual([
      { label: "Contacts / 1 / Name", value: "Ari" },
      { label: "Contacts / 2 / Name", value: "Bo" },
    ]);
  });

  test("recognizes image sources by data type, extension, or field label", () => {
    expect(isJsonImageValue("data:image/png;base64,abc", "Avatar")).toBe(true);
    expect(isJsonImageValue("https://example.com/photo.webp?size=small", "Attachment")).toBe(true);
    expect(isJsonImageValue("https://images.example.com/abc123", "Profile image")).toBe(true);
    expect(isJsonImageValue("https://example.com/profile", "Website")).toBe(false);
  });

  test("recognizes arrays of image sources without including them in the text summary", () => {
    const images = ["data:image/png;base64,abc", "https://example.com/gallery/photo.webp"];

    expect(isJsonImageArray(images, "Gallery")).toBe(true);
    expect(isJsonImageArray([...images, "Not an image"], "Gallery")).toBe(false);
    expect(getJsonCellSummary({ images, caption: "Launch day" })).toBe("Launch day");
  });

  test("summarizes useful values without JSON syntax", () => {
    expect(getJsonCellSummary({ name: "Mina", active: true, plan: "Growth", seats: 12 })).toBe("Mina · Yes · 2 more");
    expect(getJsonCellSummary([])).toBe("No details");
  });
});

describe("friendly JSON display", () => {
  test("maps JSON values to serializable read-only Param Editor fields", () => {
    const avatar = "data:image/png;base64,avatar";
    const gallery = ["data:image/png;base64,one", "https://example.com/two.webp"];

    expect(
      buildFriendlyJsonParams({
        customer: { name: "Mina", seats: 12, verified: true, phone: null },
        interests: ["Design", "Travel"],
        avatar,
        gallery,
      }),
    ).toEqual([
      { id: "friendly-json-0", name: "Customer / Name", type: "readOnly", value: "Mina" },
      { id: "friendly-json-1", name: "Customer / Seats", type: "readOnly", value: 12 },
      { id: "friendly-json-2", name: "Customer / Verified", type: "readOnly", value: true },
      { id: "friendly-json-3", name: "Customer / Phone", type: "readOnly", value: null },
      { id: "friendly-json-4", name: "Interests", type: "readOnly", value: ["Design", "Travel"] },
      {
        id: "friendly-json-5",
        name: "Avatar",
        type: "readOnly",
        value: { type: "image", src: avatar, alt: "Avatar preview" },
      },
      {
        id: "friendly-json-6",
        name: "Gallery",
        type: "readOnly",
        value: {
          type: "image-gallery",
          images: [
            { src: gallery[0], alt: "Gallery 1 preview" },
            { src: gallery[1], alt: "Gallery 2 preview" },
          ],
        },
      },
    ]);
  });
});
