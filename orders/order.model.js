import mongoose from "mongoose";

const CustomerDetailsSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: null },
    city: { type: String, required: true },
    street: { type: String, required: true },
    houseNumber: { type: String, required: true },
    zip: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: false },
);

const CartItemSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "" },
    title: { type: String, required: true },
    size: { type: String, default: "" },
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
    imageUrl: { type: String, default: "" },
    category: { type: String, default: "" },
  },
  { _id: false },
);

const TotalsSchema = new mongoose.Schema(
  {
    standardQty: { type: Number, default: 0 },
    pairQty: { type: Number, default: 0 },
    tripleQty: { type: Number, default: 0 },
    standardSubtotal: { type: Number, default: 0 },
    pairSubtotal: { type: Number, default: 0 },
    tripleSubtotal: { type: Number, default: 0 },
    otherSubtotal: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

const OrderSchema = new mongoose.Schema(
  {
    source: { type: String, default: "site" },
    section: { type: String, default: "" },
    customerDetails: { type: CustomerDetailsSchema, required: true },
    cart: { type: [CartItemSchema], required: true },
    totals: { type: TotalsSchema, required: true },
    mailSent: { type: Boolean, default: false },
    mailError: { type: String, default: null },
    status: { type: String, default: "received" },
  },
  { timestamps: true },
);

export const Order = mongoose.model("Order", OrderSchema);
