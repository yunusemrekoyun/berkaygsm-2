import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkPaynetTransaction, createPaynetMailOrder } from "./paynetService.js";

const mocks = vi.hoisted(() => ({
  logger: { error: vi.fn(), info: vi.fn() },
  config: {
    baseUrl: "https://paynet.example",
    secretKey: "test-secret-never-log",
  },
}));

vi.mock("../config/paynet.js", () => ({
  assertPaynetConfigured: () => mocks.config,
}));
vi.mock("../utils/logger.js", () => ({ logger: mocks.logger }));

const mailorder = {
  referenceNo: "pn_test",
  amount: 149.99,
  confirmationUrl: "https://shop.example/callback",
  returnUrl: "https://shop.example/return",
  buyer: { name: "Test", surname: "Buyer", email: "private@example.com", phone: "5550000000" },
  address: { addressLine: "private-address", city: "Test" },
};
const paymentUrl = "https://paynet.example/payment?token=private-token";
const row = { xact_id: "xact-test", is_succeed: true, xact_date: "2026-09-15" };

const operations = [
  {
    name: "mailorder create",
    call: () => createPaynetMailOrder(mailorder),
    path: "/v1/mailorder/create",
    success: { payment_url: paymentUrl },
  },
  {
    name: "transaction check",
    call: () => checkPaynetTransaction({ referenceNo: "pn_test", xactId: "xact-test" }),
    path: "/v1/transaction/check",
    success: { code: 0, Data: [row] },
  },
];

function abortable(signal) {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

describe("Paynet HTTP requests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe.each(operations)("$name", operation => {
    it("preserves the request and successful response without logging payment tokens", async () => {
      fetch.mockResolvedValue(Response.json(operation.success));

      const result = await operation.call();

      expect(fetch).toHaveBeenCalledTimes(1);
      const [endpoint, options] = fetch.mock.calls[0];
      expect(endpoint).toBe(`https://paynet.example${operation.path}`);
      expect(options.method).toBe("POST");
      expect(options.headers.Authorization).toBe("Basic test-secret-never-log");
      expect(JSON.parse(options.body).reference_no).toBe("pn_test");
      expect(options.signal.aborted).toBe(false);
      if (operation.name === "mailorder create") {
        expect(JSON.parse(options.body)).toMatchObject({
          amount: "149.99", buyer_email: "private@example.com",
        });
        expect(result).toEqual({ paymentUrl, referanceNo: "pn_test", referenceNo: "pn_test" });
      } else {
        expect(JSON.parse(options.body).xact_id).toBe("xact-test");
        expect(result).toEqual({ row, rows: [row], raw: operation.success });
      }
      const logs = JSON.stringify(mocks.logger.info.mock.calls);
      expect(logs).not.toContain("private-token");
      expect(logs).not.toContain("private@example.com");
      expect(logs).not.toContain(mocks.config.secretKey);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("records ECONNRESET and correlation fields without retrying or exposing raw errors", async () => {
      fetch.mockRejectedValue(new TypeError("private@example.com test-secret-never-log", {
        cause: Object.assign(new Error("private-address"), { code: "ECONNRESET" }),
      }));

      const error = await operation.call().catch(error => error);

      expect(error).toMatchObject({ status: 502, code: "PAYNET_NETWORK_ERROR" });
      expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({
        referanceNo: "pn_test",
        endpoint: `https://paynet.example${operation.path}`,
        phase: "request",
        causeCode: "ECONNRESET",
        errorName: "TypeError",
        elapsedMs: 0,
      }), "paynet: API request failed");
      const output = JSON.stringify(mocks.logger.error.mock.calls) + error.message;
      for (const sensitive of ["private@example.com", "private-address", mocks.config.secretKey]) {
        expect(output).not.toContain(sensitive);
      }
      expect(error.cause).toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("aborts an unanswered request after 30 seconds without retrying", async () => {
      fetch.mockImplementation((_, { signal }) => abortable(signal));
      const outcome = operation.call().catch(error => error);

      await vi.advanceTimersByTimeAsync(29_999);
      expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      expect(await outcome).toMatchObject({ status: 504, code: "PAYNET_TIMEOUT" });
      expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
      expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({
        phase: "request", elapsedMs: 30_000, timeoutMs: 30_000,
      }), "paynet: API request failed");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("keeps the original deadline while waiting for a slow response body", async () => {
      fetch.mockImplementation((_, { signal }) => new Promise(resolve => {
        setTimeout(() => resolve({
          status: 200,
          ok: true,
          text: () => abortable(signal),
        }), 20_000);
      }));
      const outcome = operation.call().catch(error => error);

      await vi.advanceTimersByTimeAsync(30_000);

      expect(await outcome).toMatchObject({ status: 504, code: "PAYNET_TIMEOUT" });
      expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({
        phase: "read_body", status: 200, elapsedMs: 30_000,
      }), "paynet: API request failed");
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("distinguishes a broken response body from invalid JSON", async () => {
      fetch.mockResolvedValue({
        status: 200,
        text: () => Promise.reject(new TypeError("terminated", {
          cause: Object.assign(new Error("socket closed"), { code: "UND_ERR_SOCKET" }),
        })),
      });

      await expect(operation.call()).rejects.toMatchObject({
        status: 502, code: "PAYNET_NETWORK_ERROR",
      });
      expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({
        phase: "read_body", status: 200, causeCode: "UND_ERR_SOCKET",
      }), "paynet: API request failed");
      expect(vi.getTimerCount()).toBe(0);
    });

    it("reports malformed JSON without logging or returning the provider body", async () => {
      fetch.mockResolvedValue(new Response("<html>private-token test-secret-never-log</html>", {
        status: 502,
      }));

      const error = await operation.call().catch(error => error);

      expect(error).toMatchObject({ status: 502, code: "PAYNET_INVALID_RESPONSE" });
      expect(mocks.logger.error).toHaveBeenCalledWith(expect.objectContaining({
        phase: "parse_json", status: 502,
      }), "paynet: API request failed");
      const output = JSON.stringify(mocks.logger.error.mock.calls) + error.message;
      expect(output).not.toContain("private-token");
      expect(output).not.toContain(mocks.config.secretKey);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("preserves HTTP API rejection handling and clears the deadline", async () => {
      fetch.mockResolvedValue(Response.json({ message: "Provider rejected request" }, { status: 400 }));

      await expect(operation.call()).rejects.toThrow("Provider rejected request");

      expect(mocks.logger.error).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("does not turn an API business rejection into a successful transaction", async () => {
    fetch.mockResolvedValue(Response.json({ code: 5, message: "Not found", Data: [row] }));
    await expect(checkPaynetTransaction({ referenceNo: "pn_test" })).rejects.toThrow("Not found");
  });

  it("still selects the requested transaction from multiple rows", async () => {
    const newer = { ...row, xact_id: "newer", xact_date: "2026-09-16" };
    fetch.mockResolvedValue(Response.json({ code: 0, Data: [row, newer] }));
    await expect(checkPaynetTransaction({ xactId: "xact-test" })).resolves.toMatchObject({ row });
  });

  it("does not expose a provider body when the payment URL is missing", async () => {
    fetch.mockResolvedValue(Response.json({ buyer_email: "private@example.com" }));
    const error = await createPaynetMailOrder(mailorder).catch(error => error);
    expect(error.message).toBe("Paynet ödeme sayfası URL'si alınamadı.");
    expect(error.message).not.toContain("private@example.com");
  });
});
