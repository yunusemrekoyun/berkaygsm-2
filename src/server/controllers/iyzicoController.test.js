import { describe, expect, it } from "vitest";

import { isInstallmentPaidPriceValid } from "./iyzicoController.js";

describe("isInstallmentPaidPriceValid", () => {
  it("accepts installment payments when paid price includes bank commission", () => {
    expect(
      isInstallmentPaidPriceValid(599.99, {
        installment: 6,
        price: 599.99,
        paidPrice: 673.31,
      })
    ).toBe(true);
  });

  it("keeps single-shot payments strict", () => {
    expect(
      isInstallmentPaidPriceValid(599.99, {
        installment: 1,
        price: 599.99,
        paidPrice: 599.99,
      })
    ).toBe(true);

    expect(
      isInstallmentPaidPriceValid(599.99, {
        installment: 1,
        price: 599.99,
        paidPrice: 673.31,
      })
    ).toBe(false);
  });
});
