import { createOpinion, listOpinions } from "./opinion.service.js";

export async function getOpinions(req, res) {
  const opinions = await listOpinions(req.query.limit);
  res.json(opinions);
}

export async function postOpinion(req, res) {
  const { website } = req.body || {};
  if (website && String(website).trim().length > 0)
    return res.status(200).json({ ok: true });

  const { firstName, rating, text, consent } = req.body || {};
  const result = await createOpinion({
    firstName,
    rating,
    text,
    consent,
    file: req.file,
  });

  if (result.error) return res.status(400).json({ message: result.error });

  res.status(201).json(result.created);
}
