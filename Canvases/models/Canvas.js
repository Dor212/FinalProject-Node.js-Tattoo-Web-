import mongoose from "mongoose";

const VariantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: "" },
    color: { type: String, required: true },
    imageUrl: { type: String, required: true },
  },
  { _id: false },
);

const CanvasSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    size: { type: String, required: true, enum: ["80×25", "80×60", "50×40"] },
    imageUrl: { type: String, required: true },
    variants: { type: [VariantSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export default mongoose.model("Canvas", CanvasSchema);
