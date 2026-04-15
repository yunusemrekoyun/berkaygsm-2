import { describe, expect, it } from "vitest";

import {
  normalizeShipmentRecord,
  parseCreateOrderResponse,
} from "./mngKargoService.js";

describe("mngKargoService", () => {
  it("parses createOrder array responses and extracts shipmentId", () => {
    const parsed = parseCreateOrderResponse(
      [
        {
          orderInvoiceId: "1750706903",
          orderInvoiceDetailId: "883755048",
          shipperBranchCode: "04300100",
          referenceId: "AYY-20260415-81CO",
        },
      ],
      "AYY-20260415-81CO"
    );

    expect(parsed).toMatchObject({
      shipmentId: "1750706903",
      referenceId: "AYY-20260415-81CO",
      orderInvoiceId: "1750706903",
      orderInvoiceDetailId: "883755048",
      shipperBranchCode: "04300100",
    });
  });

  it("parses createOrder object responses as a fallback", () => {
    const parsed = parseCreateOrderResponse(
      {
        orderInvoiceDetailId: "883755048",
      },
      "AYY-20260415-81CO"
    );

    expect(parsed).toMatchObject({
      shipmentId: "883755048",
      referenceId: "AYY-20260415-81CO",
      orderInvoiceId: null,
      orderInvoiceDetailId: "883755048",
    });
  });

  it("normalizes nested shipment sync payloads without inventing a tracking url", () => {
    const normalized = normalizeShipmentRecord({
      shipment: {
        referenceId: "AYY-20260415-81CO",
        shipmentStatusCode: 3,
        shipmentNumber: "MNG123456",
      },
    });

    expect(normalized).toMatchObject({
      referenceId: "AYY-20260415-81CO",
      statusCode: 3,
      barcode: "MNG123456",
      trackingUrl: null,
      shipmentId: "MNG123456",
    });
  });

  it("normalizes root-level sync payloads", () => {
    const normalized = normalizeShipmentRecord({
      referenceId: "AYY-20260415-81CO",
      trackingUrl: "https://mng.example/track/123",
      shipmentId: "MNG123456",
      shipmentStatusCode: 5,
    });

    expect(normalized).toMatchObject({
      referenceId: "AYY-20260415-81CO",
      shipmentId: "MNG123456",
      barcode: null,
      trackingUrl: "https://mng.example/track/123",
      statusCode: 5,
    });
  });
});
