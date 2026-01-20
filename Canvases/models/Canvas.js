import mongoose from "mongoose";

const CanvasSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    size: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("Canvas", CanvasSchema);
