import { describe, expect, it } from "vitest";
import {
  classifyTrafficSource,
  extractCampaignParams,
  normalizeComparableHost,
} from "./visitAttribution.js";

describe("visitAttribution", () => {
  it("normalizes comparable hosts", () => {
    expect(normalizeComparableHost("https://www.CepLife.com:443/path")).toBe(
      "ceplife.com"
    );
  });

  it("detects paid traffic from utm medium and click ids", () => {
    expect(
      classifyTrafficSource({
        currentHost: "ceplife.com",
        utmSource: "google",
        utmMedium: "cpc",
        clickIdType: "gclid",
      })
    ).toBe("paid");
  });

  it("detects organic, social and email traffic", () => {
    expect(
      classifyTrafficSource({
        currentHost: "ceplife.com",
        referrer: "https://www.google.com/search?q=ceplife",
      })
    ).toBe("organic");

    expect(
      classifyTrafficSource({
        currentHost: "ceplife.com",
        referrer: "https://instagram.com/some/path",
      })
    ).toBe("social");

    expect(
      classifyTrafficSource({
        currentHost: "ceplife.com",
        utmSource: "newsletter",
        utmMedium: "email",
      })
    ).toBe("email");
  });

  it("treats same-site referrers as internal", () => {
    expect(
      classifyTrafficSource({
        currentHost: "www.ceplife.com",
        referrer: "https://ceplife.com/product/test",
      })
    ).toBe("internal");
  });

  it("extracts utm values and click ids", () => {
    expect(
      extractCampaignParams(
        "utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc123"
      )
    ).toEqual({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "spring",
      utmTerm: "",
      utmContent: "",
      clickId: "abc123",
      clickIdType: "gclid",
    });
  });
});
