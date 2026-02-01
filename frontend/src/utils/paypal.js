let paypalSdkPromise = null;

export function loadPayPalSdk({
  clientId,
  currency = "EUR",
  intent = "capture",
  locale = "de_DE",
} = {}) {
  if (!clientId) {
    return Promise.reject(new Error("PayPal client id is not configured"));
  }
  if (window.paypal) {
    return Promise.resolve(window.paypal);
  }
  if (paypalSdkPromise) {
    return paypalSdkPromise;
  }

  const params = new URLSearchParams({
    "client-id": clientId,
    currency,
    intent: intent.toUpperCase(),
    locale,
    components: "buttons",
    commit: "true",
  });

  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => {
      if (window.paypal) resolve(window.paypal);
      else reject(new Error("PayPal SDK loaded but window.paypal is missing"));
    };
    script.onerror = () =>
      reject(new Error("Failed to load PayPal SDK script"));
    document.head.appendChild(script);
  }).catch((error) => {
    paypalSdkPromise = null;
    throw error;
  });

  return paypalSdkPromise;
}
