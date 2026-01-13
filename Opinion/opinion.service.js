import Opinion from "./opinion.model.js";
import cloudinary from "./cloudinary.service.js";

export async function listOpinions(limit = 24) {
  const safeLimit = Math.min(Number(limit || 24), 60);
  return Opinion.find().sort({ createdAt: -1 }).limit(safeLimit).lean();
}

export async function createOpinion({
  firstName,
  rating,
  text,
  consent,
  file,
}) {
  const cleanFirstName = String(firstName || "").trim();
  const cleanText = String(text || "").trim();
  const cleanRating = Number(rating);
  const cleanConsent = String(consent).toLowerCase() === "true";

  if (
    !cleanFirstName ||
    cleanFirstName.length < 2 ||
    cleanFirstName.length > 30
  ) {
    return { error: "First name is required (2-30 chars)." };
  }

  if (!Number.isFinite(cleanRating) || cleanRating < 1 || cleanRating > 5) {
    return { error: "Rating must be between 1 and 5." };
  }

  if (!cleanConsent) {
    return { error: "Consent is required." };
  }

  if (!file) {
    return { error: "Image is required." };
  }

  const base64 = `data:${file.mimetype};base64,${file.buffer.toString(
    "base64"
  )}`;

  const uploadRes = await cloudinary.uploader.upload(base64, {
    folder: "omer/opinion",
    resource_type: "image",
  });

  const created = await Opinion.create({
    firstName: cleanFirstName,
    rating: cleanRating,
    text: cleanText,
    imageUrl: uploadRes.secure_url,
    consent: true,
  });

  return { created };
}
