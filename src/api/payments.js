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
    // addressId yalnızca gerçek bir değer varsa eklenir; null/undefined gönderilirse
    // Zod şeması (z.string().optional()) reddeder — misafir akışında bu alan olmaz.
    const body = { items };
    if (addressId) body.addressId = addressId;
    if (couponCode != null) body.couponCode = couponCode;
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
