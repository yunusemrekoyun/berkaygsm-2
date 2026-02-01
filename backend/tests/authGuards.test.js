import express from "express";
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import productsRouter from "../routes/products.js";
import setsRouter from "../routes/sets.js";
import stocksRouter from "../routes/stocks.js";
import ordersRouter from "../routes/orders.js";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/products", productsRouter);
  app.use("/api/sets", setsRouter);
  app.use("/api/stocks", stocksRouter);
  app.use("/api/orders", ordersRouter);
  return app;
}

describe("authentication guards", () => {
  let app;

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || "test-access-secret";
    app = createTestApp();
  });

  it("rejects unauthenticated product creation", async () => {
    const res = await request(app)
      .post("/api/products")
      .send({ name: "Test Product", price: 10 });
    expect(res.status).toBe(401);
    expect(res.body?.message || "").toMatch(/token/i);
  });

  it("rejects unauthenticated set updates", async () => {
    const res = await request(app)
      .put("/api/sets/some-set")
      .send({ name: "New Name" });
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated stock mutations", async () => {
    const res = await request(app).post("/api/stocks").send({
      ownerModel: "Product",
      owner: "507f191e810c19729de860ea",
      qtyOnHand: 10,
      mode: "set",
    });
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated order creation attempts", async () => {
    const res = await request(app).post("/api/orders").send({
      addressId: "507f191e810c19729de860ea",
      items: [],
    });
    expect(res.status).toBe(401);
  });
});
