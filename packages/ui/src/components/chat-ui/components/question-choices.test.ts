import { describe, expect, it } from "bun:test";
import { questionOffersOtherChoice } from "./question-choices";

describe("question Other choice", () => {
  it("offers Other beside listed options", () => {
    expect(questionOffersOtherChoice({ options: [{ label: "Hello" }], allowCustomAnswer: true })).toBe(true);
  });

  it("leaves a question with no options as a plain answer field", () => {
    // Nothing is listed, so the field is the answer and there is nothing to be other than.
    expect(questionOffersOtherChoice({ options: [], allowCustomAnswer: true })).toBe(false);
  });

  it("offers no free text when the question does not allow it", () => {
    expect(questionOffersOtherChoice({ options: [{ label: "Hello" }] })).toBe(false);
  });
});
