import { describe, expect, it } from "vitest";
import {
  isCloudinaryImageUrl,
  optimizeCloudinaryImageUrl,
} from "./cloudinaryImage.js";

describe("cloudinaryImage utils", () => {
  it("detects cloudinary upload URLs", () => {
    expect(
      isCloudinaryImageUrl(
        "https://res.cloudinary.com/demo/image/upload/v123/sample.jpg"
      )
    ).toBe(true);
    expect(isCloudinaryImageUrl("/hero-1.jpg")).toBe(false);
  });

  it("injects width and quality transforms without dropping query params", () => {
    expect(
      optimizeCloudinaryImageUrl(
        "https://res.cloudinary.com/demo/image/upload/v123/sample.jpg?x=1",
        { width: 1600, quality: 82 }
      )
    ).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good,c_limit,w_1600/v123/sample.jpg?x=1"
    );
  });

  it("leaves non-cloudinary URLs untouched", () => {
    expect(optimizeCloudinaryImageUrl("https://example.com/test.jpg")).toBe(
      "https://example.com/test.jpg"
    );
  });
});
