import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  set: vi.fn(),
  connection: {
    readyState: 0,
    on: vi.fn(),
  },
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("mongoose", () => ({
  default: {
    connect: mocks.connect,
    connection: mocks.connection,
    set: mocks.set,
  },
}));

vi.mock("../utils/logger.js", () => ({
  logger: mocks.logger,
}));

async function loadConnectDB() {
  const mod = await import("./db.js");
  return mod.connectDB;
}

describe("connectDB", () => {
  beforeEach(() => {
    vi.resetModules();
    delete globalThis.__ceplifeMongoState;
    process.env.MONGODB_URI = "mongodb://localhost:27017/ceplife-test";

    mocks.connect.mockReset();
    mocks.set.mockReset();
    mocks.connection.readyState = 0;
    mocks.connection.on.mockReset();
    mocks.logger.error.mockReset();
    mocks.logger.info.mockReset();
    mocks.logger.warn.mockReset();
  });

  it("does not open a new connection when mongoose is already connected", async () => {
    mocks.connection.readyState = 1;
    const connectDB = await loadConnectDB();

    await connectDB();

    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("clears a failed connection promise so the next request can retry", async () => {
    const firstError = new Error("temporary atlas outage");
    mocks.connect
      .mockRejectedValueOnce(firstError)
      .mockImplementationOnce(async () => {
        mocks.connection.readyState = 1;
      });

    const connectDB = await loadConnectDB();

    await expect(connectDB()).rejects.toThrow("temporary atlas outage");
    await expect(connectDB()).resolves.toBeUndefined();

    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });

  it("reconnects when a previously resolved promise is stale after disconnect", async () => {
    mocks.connect.mockImplementation(async () => {
      mocks.connection.readyState = 1;
    });

    const connectDB = await loadConnectDB();
    await connectDB();

    mocks.connection.readyState = 0;
    await connectDB();

    expect(mocks.connect).toHaveBeenCalledTimes(2);
  });
});
