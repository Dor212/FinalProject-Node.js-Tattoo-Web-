import rateLimit from "express-rate-limit";

export const opinionRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many submissions. Try again later." },
});
