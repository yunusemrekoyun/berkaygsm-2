import { describe, expect, it } from "vitest";
import { buildUserFilter } from "./userPresenter.js";

describe("buildUserFilter", () => {
  it("defaults to active users when no status is provided", () => {
    expect(buildUserFilter({})).toMatchObject({ isDeleted: false });
  });

  it("includes deleted users when status is all and includeDeleted is true", () => {
    expect(
      buildUserFilter({ status: "all", includeDeleted: true })
    ).not.toHaveProperty("isDeleted");
  });

  it("filters only active users when status is active", () => {
    expect(
      buildUserFilter({ status: "active", includeDeleted: true })
    ).toMatchObject({ isDeleted: false });
  });

  it("filters only deleted users when status is deleted", () => {
    expect(buildUserFilter({ status: "deleted" })).toMatchObject({
      isDeleted: true,
    });
  });
});
