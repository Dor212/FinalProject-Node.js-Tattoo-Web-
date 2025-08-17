// models/product.schema.js
import mongoose from "mongoose";

const sizeStockSchema = new mongoose.Schema(
  {
    initial: { type: Number, default: 0 },
    current: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String, required: true },

    description: { type: String, default: "" },
    
    stock: {
      l: { type: sizeStockSchema, required: false },
      xl: { type: sizeStockSchema, required: false },
      xxl: { type: sizeStockSchema, required: false },
    },
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
