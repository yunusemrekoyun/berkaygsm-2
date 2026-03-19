import { describe, expect, it } from "vitest";
import { resolveImageSrc } from "./imageSrc.js";

describe("resolveImageSrc", () => {
  it("returns valid string paths as-is", () => {
    expect(resolveImageSrc("/cat-1.jpg")).toBe("/cat-1.jpg");
    expect(resolveImageSrc("https://example.com/a.jpg")).toBe(
      "https://example.com/a.jpg"
    );
  });

  it("extracts image URLs from media objects", () => {
    expect(
      resolveImageSrc({
        url: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
      })
    ).toBe("https://res.cloudinary.com/demo/image/upload/v1/sample.jpg");
  });

  it("rejects invalid object-like strings and unsupported relative paths", () => {
    expect(resolveImageSrc("[object Object]")).toBe(null);
    expect(resolveImageSrc("cat-1.jpg")).toBe(null);
    expect(resolveImageSrc({ nope: true })).toBe(null);
  });
});
