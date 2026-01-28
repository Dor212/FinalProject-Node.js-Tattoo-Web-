import express from "express";
import {
  buildReturnUrls,
  hypApiSignSign,
  hypApiSignVerify,
} from "../services/hypay.service.js";

const router = express.Router();

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function safeOrderId(input) {
  return String(input).slice(0, 64);
}

router.post("/create-payment", async (req, res) => {
  try {
    const body = req.body ?? {};
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ ok: false, message: "amount must be a positive number" });
    }
    const orderId = isNonEmptyString(body.orderId)
      ? safeOrderId(body.orderId)
      : `ORD-${Date.now()}`;
    const info = isNonEmptyString(body.info)
      ? body.info.trim()
      : `OmerAviv order ${orderId}`;
    const payload = {
      orderId,
      info,
      amount,
      coin: body.coin ?? 1,
      pageLang: body.pageLang ?? "HEB",
      moreData: true,
      userId: isNonEmptyString(body.userId) ? body.userId.trim() : "000000000",
      clientName: isNonEmptyString(body.clientName)
        ? body.clientName.trim()
        : undefined,
      clientLName: isNonEmptyString(body.clientLName)
        ? body.clientLName.trim()
        : undefined,
      email: isNonEmptyString(body.email) ? body.email.trim() : undefined,
      phone: isNonEmptyString(body.phone) ? body.phone.trim() : undefined,
      cell: isNonEmptyString(body.cell) ? body.cell.trim() : undefined,
      street: isNonEmptyString(body.street) ? body.street.trim() : undefined,
      city: isNonEmptyString(body.city) ? body.city.trim() : undefined,
      zip: isNonEmptyString(body.zip) ? body.zip.trim() : undefined,
      tmp: typeof body.tmp === "number" ? body.tmp : undefined,
      sendHesh: body.sendHesh === true,
      sendEmail: body.sendEmail === true,
      pritim: body.pritim === true,
      heshDesc: isNonEmptyString(body.heshDesc) ? body.heshDesc : undefined,
    };

    const { successUrl, failureUrl, cancelUrl } = buildReturnUrls();
    const signResult = await hypApiSignSign(payload);
    const base = process.env.HYP_BASE_URL;
    const paymentUrl = `${base}?${signResult.raw}`;

    return res.json({
      ok: true,
      paymentUrl,
      orderId,
      recommendedRedirects: { successUrl, failureUrl, cancelUrl },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/verify", async (req, res) => {
  try {
    const queryParams = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (Array.isArray(v)) queryParams[k] = v[0];
      else queryParams[k] = v;
    }

    const verifyResult = await hypApiSignVerify(queryParams);

    const ccode = String(verifyResult.data.CCode ?? "");
    const verified = ccode === "0";

    return res.json({
      ok: true,
      verified,
      ccode,
      data: verifyResult.data,
      raw: verifyResult.raw,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
