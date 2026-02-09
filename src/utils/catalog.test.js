import { describe, expect, it } from "vitest";
import {
  collectDescendantIds,
  flattenCategoryTree,
  mapCategoryTree,
} from "./catalog.js";

const tree = [
  {
    id: "root-1",
    name: "Aksesuar",
    slug: "aksesuar",
    image: { url: "/a.jpg" },
    children: [
      {
        id: "child-1",
        name: "Kilif",
        slug: "kilif",
        image: "/k.jpg",
        children: [{ id: "grand-1", name: "iPhone Kilif", slug: "iphone" }],
      },
    ],
  },
];

describe("catalog utils", () => {
  it("flattens category tree with levels and paths", () => {
    const result = flattenCategoryTree(tree);
    expect(result).toHaveLength(3);
    expect(result[0].level).toBe(0);
    expect(result[1].level).toBe(1);
    expect(result[2].path).toEqual(["Aksesuar", "Kilif", "iPhone Kilif"]);
  });

  it("collects descendant ids for a selected node", () => {
    const result = collectDescendantIds(tree, "root-1");
    expect(result).toEqual(["child-1", "grand-1"]);
  });

  it("maps category images from mixed image formats", () => {
    const mapped = mapCategoryTree(tree);
    expect(mapped[0].image).toBe("/a.jpg");
    expect(mapped[0].children[0].image).toBe("/k.jpg");
    expect(mapped[0].children[0].children[0].image).toBe(null);
  });
});
