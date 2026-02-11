import mongoose from "mongoose";

const CustomerDetailsSchema = new mongoose.Schema(
  {
    fullname: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
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
    subtotal: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    standardQty: { type: Number, default: 0 },
    pairQty: { type: Number, default: 0 },
    tripleQty: { type: Number, default: 0 },
    standardSubtotal: { type: Number, default: 0 },
    pairSubtotal: { type: Number, default: 0 },
    tripleSubtotal: { type: Number, default: 0 },
    otherSubtotal: { type: Number, default: 0 },
  },
  { _id: false },
);

const PaymentSchema = new mongoose.Schema(
  {
    provider: { type: String, default: "hyp" },
    orderId: { type: String, default: "" },
    ccode: { type: String, default: "" },
    transactionId: { type: String, default: "" },
    raw: { type: Object, default: null },
    verifiedAt: { type: Date, default: null },
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
    payment: { type: PaymentSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "failed", "canceled"],
      default: "pending_payment",
    },
    adminMailSent: { type: Boolean, default: false },
    customerMailSent: { type: Boolean, default: false },
    adminMailError: { type: String, default: "" },
    customerMailError: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Order = mongoose.model("Order", OrderSchema);
