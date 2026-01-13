import mongoose from "mongoose";

const OpinionSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 220,
      default: "",
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    consent: {
      type: Boolean,
      required: true,
      validate: {
        validator: (v) => v === true,
        message: "Consent must be true",
      },
    },
  },
  { timestamps: true }
);

const Opinion = mongoose.model("Opinion", OpinionSchema);
export default Opinion;
