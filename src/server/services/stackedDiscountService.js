import StackedDiscount from "../models/StackedDiscount.js";

export async function getStackedDiscountConfig() {
  return StackedDiscount.findOne({ singleton: "stacked_discount" }).lean();
}

