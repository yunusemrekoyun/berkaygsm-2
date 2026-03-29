import { describe, expect, it } from "vitest";
import {
  getClientIp,
  shouldTrustProxyIpHeaders,
} from "./clientIp.js";

describe("clientIp utils", () => {
  it("ignores spoofable proxy headers when proxy trust is disabled", () => {
    expect(
      getClientIp(
        {
          "x-forwarded-for": "1.2.3.4",
          "x-real-ip": "5.6.7.8",
        },
        { trustProxyHeaders: false }
      )
    ).toBe("");
  });

  it("uses the first trusted forwarded ip when proxy trust is enabled", () => {
    expect(
      getClientIp(
        {
          "x-forwarded-for": "1.2.3.4, 10.0.0.1",
        },
        { trustProxyHeaders: true }
      )
    ).toBe("1.2.3.4");
  });

  it("normalizes ipv4 ports and ipv6 mapped addresses", () => {
    expect(
      getClientIp(
        {
          "x-real-ip": "8.8.8.8:443",
        },
        { trustProxyHeaders: true }
      )
    ).toBe("8.8.8.8");

    expect(
      getClientIp(
        {
          "x-real-ip": "::ffff:9.9.9.9",
        },
        { trustProxyHeaders: true }
      )
    ).toBe("9.9.9.9");
  });

  it("auto trusts proxy headers on hosted environments or explicit env", () => {
    expect(shouldTrustProxyIpHeaders({ VERCEL: "1" })).toBe(true);
    expect(shouldTrustProxyIpHeaders({ TRUST_PROXY_IP_HEADERS: "true" })).toBe(
      true
    );
    expect(shouldTrustProxyIpHeaders({ TRUST_PROXY_IP_HEADERS: "false" })).toBe(
      false
    );
  });
});
