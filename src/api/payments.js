import { http } from "./client.js";

export const paymentApi = {
  async initializePaynetCheckout({
    addressId,
    addressSnapshot = null,
    guestCustomer = null,
    items,
    couponCode = null,
    note = null,
    identityNumber = null,
    auth = true,
  }) {
    const body = { items };
    if (addressId) body.addressId = addressId;
    if (couponCode != null) body.couponCode = couponCode;
    if (addressSnapshot) body.addressSnapshot = addressSnapshot;
    if (guestCustomer) body.guestCustomer = guestCustomer;
    if (note) body.note = note;
    if (identityNumber) body.identityNumber = identityNumber;
    return http("/payments/paynet/initialize", {
      method: "POST",
      auth,
      body,
    });
  },
};
