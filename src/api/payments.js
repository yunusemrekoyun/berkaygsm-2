import { http } from "./client.js";

export const paymentApi = {
  async initializeIyzicoCheckout({
    addressId,
    addressSnapshot = null,
    guestCustomer = null,
    items,
    couponCode = null,
    note = null,
    identityNumber = null,
    auth = true,
  }) {
    const body = { addressId, items, couponCode };
    if (addressSnapshot) body.addressSnapshot = addressSnapshot;
    if (guestCustomer) body.guestCustomer = guestCustomer;
    if (note) body.note = note;
    if (identityNumber) body.identityNumber = identityNumber;
    return http("/payments/iyzico/initialize", {
      method: "POST",
      auth,
      body,
    });
  },
};
