import { describe, expect, it } from "vitest";
import {
  buildIyzicoAuthorizationHeader,
  normalizeIyzicoPrice,
  validateIyzicoHppWebhookSignature,
  verifyIyzicoInitializeSignature,
  verifyIyzicoRetrieveSignature,
} from "./iyzicoService.js";

describe("iyzicoService", () => {
  it("builds IYZWSv2 authorization headers with hmac payload signing", () => {
    expect(
      buildIyzicoAuthorizationHeader({
        apiKey: "sandbox-api",
        secretKey: "sandbox-secret",
        path: "/payment/iyzipos/checkoutform/initialize/auth/ecom",
        body: {
          locale: "tr",
          conversationId: "123",
          price: 10,
          paidPrice: 10,
          currency: "TRY",
          callbackUrl: "https://example.com",
        },
        randomKey: "123456789",
      })
    ).toBe(
      "IYZWSv2 YXBpS2V5OnNhbmRib3gtYXBpJnJhbmRvbUtleToxMjM0NTY3ODkmc2lnbmF0dXJlOmE4MDViMGQ0YTc4MjcxMjYxMmMwMDc1ODNhNzdiMmM2ZjQ2MGZjODE5ODBhM2UxMTlhYzg1YjNmMWEyYTZhM2E="
    );
  });

  it("validates checkout form initialize signatures", () => {
    expect(
      verifyIyzicoInitializeSignature("sandbox-secret", {
        conversationId: "conversationId",
        token: "077aff05-1e9b-44aa-aa11-c268bb8b3826",
        signature:
          "12cc8deb94f71683efe084c7bd4b1752ef8ab0a53ca0c27ba9c367ba9c0e3262",
      })
    ).toBe(true);
  });

  it("validates checkout form retrieve signatures and normalizes prices", () => {
    expect(
      verifyIyzicoRetrieveSignature("sandbox-secret", {
        paymentStatus: "SUCCESS",
        paymentId: "24478123",
        currency: "TRY",
        basketId: "basketId",
        conversationId: "8152109759",
        paidPrice: "6.00",
        price: "6.0",
        token: "077aff05-1e9b-44aa-aa11-c268bb8b3826",
        signature:
          "f84bab139817bc29ab5094c7f5955f50f5c5f40f434b9db6a392ac2cca5e157e",
      })
    ).toBe(true);
    expect(normalizeIyzicoPrice("10.50")).toBe(10.5);
  });

  it("validates hpp webhook signatures", () => {
    process.env.IYZICO_SECRET_KEY = "sandbox-secret";
    expect(
      validateIyzicoHppWebhookSignature(
        {
          iyziEventType: "CHECKOUT_FORM_AUTH",
          iyziPaymentId: "24478123",
          token: "077aff05-1e9b-44aa-aa11-c268bb8b3826",
          paymentConversationId: "8152109759",
          status: "SUCCESS",
        },
        "d27cfd2894e8b0278c2750cd152d3de4647ebe7bc92f5ddb895ce30ae9d49023"
      )
    ).toBe(true);
  });
});
