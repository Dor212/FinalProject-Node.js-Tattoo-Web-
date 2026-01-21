import mongoose from "mongoose";

const CanvasVariantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    color: { type: String, required: true },
    label: { type: String, default: "" },
    imageUrl: { type: String, required: true },
  },
  { _id: false },
);

const CanvasSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    variants: { type: [CanvasVariantSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("Canvas", CanvasSchema);
