import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    stock: {
      small: {
        initial: { type: Number, default: 0 },
        current: { type: Number, default: 0 },
      },
      medium: {
        initial: { type: Number, default: 0 },
        current: { type: Number, default: 0 },
      },
      large: {
        initial: { type: Number, default: 0 },
        current: { type: Number, default: 0 },
      },
    },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
