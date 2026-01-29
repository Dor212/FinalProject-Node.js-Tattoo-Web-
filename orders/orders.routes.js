import express from "express";
import nodemailer from "nodemailer";
import { hypApiSignSign, hypApiSignVerify } from "../services/hypay.service.js";

const router = express.Router();

const PENDING_TTL_MS = 1000 * 60 * 45;
const pending = new Map();

function now() {
  return Date.now();
}

function cleanupPending() {
  const t = now();
  for (const [orderId, v] of pending.entries()) {
    if (!v || !v.createdAt || t - v.createdAt > PENDING_TTL_MS)
      pending.delete(orderId);
  }
}

function fmtILS(n) {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Number(n).toFixed(0)}₪`;
  }
}

function computeCanvasTotals(cart = []) {
  let standardQty = 0;
  let pairQty = 0;
  let tripleQty = 0;
  let otherSubtotal = 0;

  for (const i of cart) {
    const size = (i.size || "").trim();
    const cat = (i.category || "").trim();
    const qty = Number(i.quantity || 1);
    const price = typeof i.price === "number" ? i.price : undefined;

    const isStandard = size === "80×25" || cat === "standard";
    const isPair = size === "50×40" || cat === "pair";
    const isTriple = size === "80×60" || cat === "triple";

    if (isStandard) standardQty += qty;
    else if (isPair) pairQty += qty;
    else if (isTriple) tripleQty += qty;
    else if (typeof price === "number") otherSubtotal += price * qty;
  }

  let standardSubtotal = 0;
  if (standardQty > 0) {
    if (standardQty === 1) standardSubtotal = 220;
    else if (standardQty === 2) standardSubtotal = 400;
    else if (standardQty === 3) standardSubtotal = 550;
    else standardSubtotal = 550 + (standardQty - 3) * 180;
  }

  const pairSubtotal = pairQty * 390;
  const tripleSubtotal = tripleQty * 550;

  const canvasSubtotal = standardSubtotal + pairSubtotal + tripleSubtotal;
  const subtotal = canvasSubtotal + otherSubtotal;
  const shipping = 0;
  const total = subtotal + shipping;

  return {
    standardQty,
    pairQty,
    tripleQty,
    standardSubtotal,
    pairSubtotal,
    tripleSubtotal,
    otherSubtotal,
    subtotal,
    shipping,
    total,
  };
}

function unitPriceLabel(i) {
  const size = (i.size || "").trim();
  const cat = (i.category || "").trim();

  if (size === "80×25" || cat === "standard") return "—";
  if (size === "50×40" || cat === "pair") return fmtILS(390);
  if (size === "80×60" || cat === "triple") return fmtILS(550);
  if (typeof i.price === "number") return fmtILS(i.price);
  return "—";
}

function buildFrom() {
  const raw = (process.env.SMTP_FROM || "").trim();
  if (raw) {
    const u = (process.env.SMTP_USER || "").trim();
    if (u && raw.includes("SMTP_USER")) return raw.replaceAll("SMTP_USER", u);
    return raw;
  }
  return process.env.MY_EMAIL || process.env.SMTP_USER;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
  auth: {
    user: process.env.SMTP_USER || process.env.MY_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOrderEmail({
  orderId,
  customerDetails,
  cart,
  totals,
  payment,
}) {
  const to = process.env.MY_EMAIL || process.env.SMTP_USER;
  const subject = "🧾 הזמנה שולמה בהצלחה באתר (HYP)";

  const cartLines = cart
    .map((i, idx) => {
      const qty = i.quantity || 1;
      return `${idx + 1}. ${i.title} | מידה: ${i.size || "—"} | כמות: ${qty} | מחיר יח': ${unitPriceLabel(i)}`;
    })
    .join("\n");

  const paymentBlock = payment
    ? `
[תשלום]
Order: ${payment.Order ?? orderId}
CCode: ${payment.CCode ?? "—"}
Id: ${payment.Id ?? "—"}
Token: ${payment.Token ?? "—"}
`
    : "";

  const text = `
הזמנה שולמה בהצלחה 🎉
מספר הזמנה: ${orderId}

[פרטי לקוח]
שם: ${customerDetails.fullname || "—"}
טלפון: ${customerDetails.phone || "—"}
כתובת: ${customerDetails.street || ""} ${customerDetails.houseNumber || ""}, ${customerDetails.city || ""} (${customerDetails.zip || ""})
אימייל: ${customerDetails.email || "—"}

[מוצרים]
${cartLines}

סך הכל: ${fmtILS(totals.total)}
${paymentBlock}
`.trim();

  const rowsHtml = cart
    .map(
      (i, idx) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${idx + 1}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${i.title}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.size || "—"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity || 1}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${unitPriceLabel(i)}</td>
        </tr>
      `,
    )
    .join("");

  const breakdown = (() => {
    const parts = [];
    if (totals.standardQty > 0)
      parts.push(
        `<div>סטנדרטי 80×25: ${totals.standardQty} יח' — ${fmtILS(totals.standardSubtotal)}</div>`,
      );
    if (totals.pairQty > 0)
      parts.push(
        `<div>זוגות 50×40: ${totals.pairQty} סט — ${fmtILS(totals.pairSubtotal)}</div>`,
      );
    if (totals.tripleQty > 0)
      parts.push(
        `<div>שלישיות 80×60: ${totals.tripleQty} סט — ${fmtILS(totals.tripleSubtotal)}</div>`,
      );
    if (totals.otherSubtotal > 0)
      parts.push(`<div>מוצרים אחרים: ${fmtILS(totals.otherSubtotal)}</div>`);
    return parts.length
      ? `<h4 style="margin:16px 0 6px;">פירוט חישוב קאנבסים</h4><div style="line-height:1.7;">${parts.join("")}</div>`
      : "";
  })();

  const paymentHtml = payment
    ? `
      <h3 style="margin:16px 0 6px;">תשלום</h3>
      <div style="background:#f7f7f7;padding:12px;border-radius:8px;line-height:1.7;">
        <div><b>Order:</b> ${payment.Order ?? orderId}</div>
        <div><b>CCode:</b> ${payment.CCode ?? "—"}</div>
        <div><b>Id:</b> ${payment.Id ?? "—"}</div>
        <div><b>Token:</b> ${payment.Token ?? "—"}</div>
      </div>
    `
    : "";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;color:#111;" dir="rtl">
      <h2 style="margin:0 0 12px;">הזמנה שולמה בהצלחה 🎉</h2>
      <div style="color:#666;font-size:12px;margin-bottom:8px;">מספר הזמנה: ${orderId}</div>

      <h3 style="margin:12px 0 6px;">פרטי לקוח</h3>
      <div style="background:#f7f7f7;padding:12px;border-radius:8px;line-height:1.7;">
        <div><b>שם מלא:</b> ${customerDetails.fullname || "—"}</div>
        <div><b>טלפון:</b> ${customerDetails.phone || "—"}</div>
        <div><b>כתובת:</b> ${customerDetails.street || "—"} ${customerDetails.houseNumber || ""}, ${customerDetails.city || "—"}</div>
        ${customerDetails.zip ? `<div><b>מיקוד:</b> ${customerDetails.zip}</div>` : ""}
        <div><b>אימייל:</b> ${customerDetails.email || "—"}</div>
      </div>

      <h3 style="margin:16px 0 6px;">מוצרים</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:8px;text-align:right;border-bottom:1px solid #eee;">#</th>
            <th style="padding:8px;text-align:right;border-bottom:1px solid #eee;">מוצר</th>
            <th style="padding:8px;text-align:center;border-bottom:1px solid #eee;">מידה</th>
            <th style="padding:8px;text-align:center;border-bottom:1px solid #eee;">כמות</th>
            <th style="padding:8px;text-align:right;border-bottom:1px solid #eee;">מחיר יח'</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding:10px;text-align:left;font-weight:bold;">סך הכל:</td>
            <td style="padding:10px;text-align:right;font-weight:bold;">${fmtILS(totals.total)}</td>
          </tr>
        </tfoot>
      </table>

      ${breakdown}
      ${paymentHtml}

      <p style="font-size:12px;color:#666;margin-top:10px;">הודעת מייל זו נשלחה אוטומטית מהשרת.</p>
    </div>
  `;

  await transporter.sendMail({
    from: buildFrom(),
    to,
    replyTo: customerDetails?.email || undefined,
    subject,
    text,
    html,
  });
}

function normalizeQuery(reqQuery) {
  const out = {};
  for (const [k, v] of Object.entries(reqQuery || {})) {
    if (Array.isArray(v)) out[k] = v[0];
    else out[k] = v;
  }
  return out;
}

function makeOrderId() {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now()}-${r}`;
}

router.post("/checkout", async (req, res) => {
  try {
    cleanupPending();

    const { customerDetails, cart, source, section } = req.body || {};

    if (!customerDetails || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ ok: false, error: "חסרים פרטים להזמנה" });
    }

    const totals = computeCanvasTotals(cart);
    const orderId = makeOrderId();

    pending.set(orderId, {
      createdAt: now(),
      customerDetails,
      cart,
      totals,
      source: source || "checkout",
      section: section || "/checkout",
    });

    const fullName = String(customerDetails.fullname || "").trim();
    const phone = String(customerDetails.phone || "").trim();
    const email = customerDetails.email
      ? String(customerDetails.email).trim()
      : undefined;

    const clientName = fullName.split(" ")[0] || undefined;
    const clientLName = fullName.split(" ").slice(1).join(" ") || undefined;

    const amountMinor = Math.round(Number(totals.total) * 100);

    const payload = {
      orderId,
      info: `OmerAviv order ${orderId}`,
      amount: amountMinor,
      coin: 1,
      pageLang: "HEB",
      moreData: true,
      userId: "000000000",
      clientName,
      clientLName,
      email,
      phone,
      cell: phone,
      street: customerDetails.street
        ? String(customerDetails.street).trim()
        : undefined,
      city: customerDetails.city
        ? String(customerDetails.city).trim()
        : undefined,
      zip: customerDetails.zip ? String(customerDetails.zip).trim() : undefined,
    };

    const signResult = await hypApiSignSign(payload);
    const base = process.env.HYP_BASE_URL;
    const paymentUrl = `${base}?${signResult.raw}`;

    return res.json({
      ok: true,
      orderId,
      totals,
      paymentUrl,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.get("/confirm-payment", async (req, res) => {
  try {
    cleanupPending();

    const q = normalizeQuery(req.query);
    const verifyResult = await hypApiSignVerify(q);

    const ccode = String(verifyResult.data.CCode ?? "");
    const verified = ccode === "0";
    const orderId = String(verifyResult.data.Order ?? q.Order ?? "").slice(
      0,
      64,
    );

    if (!verified) {
      return res.json({
        ok: true,
        verified: false,
        ccode,
        orderId: orderId || null,
        data: verifyResult.data,
      });
    }

    const saved = orderId ? pending.get(orderId) : null;

    if (saved) {
      await sendOrderEmail({
        orderId,
        customerDetails: saved.customerDetails,
        cart: saved.cart,
        totals: saved.totals,
        payment: verifyResult.data,
      });
      pending.delete(orderId);
    } else {
      await transporter.sendMail({
        from: buildFrom(),
        to: process.env.MY_EMAIL || process.env.SMTP_USER,
        subject: "🧾 תשלום התקבל (לא נמצאה הזמנה בזיכרון)",
        text: `תשלום התקבל בהצלחה אבל לא נמצאה הזמנה תואמת בזיכרון.\nOrder: ${orderId || "—"}\nCCode: ${ccode}\nId: ${verifyResult.data.Id ?? "—"}`,
      });
    }

    return res.json({
      ok: true,
      verified: true,
      ccode,
      orderId: orderId || null,
      data: verifyResult.data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

router.post("/orders/checkout", (req, res, next) =>
  router.handle({ ...req, url: "/checkout" }, res, next),
);
router.get("/orders/confirm-payment", (req, res, next) =>
  router.handle({ ...req, url: "/confirm-payment" }, res, next),
);

export default router;
