import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();


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
  let standardQty = 0; // 80×25
  let pairQty = 0; // 50×40
  let tripleQty = 0; // 80×60
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

  // מדרגות ל-80×25: 1=220, 2=400, 3=550, מעבר ל-3: כל יחידה נוספת 180
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

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, 
  port: Number(process.env.SMTP_PORT || 465), 
  secure: process.env.SMTP_SECURE !== "false", 
  auth: {
    user: process.env.SMTP_USER || process.env.MY_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});


const createOrderHandler = async (req, res) => {
  try {
    const { customerDetails, cart, source, section } = req.body;

    if (!customerDetails || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "חסרים פרטים להזמנה" });
    }

    const totals = computeCanvasTotals(cart);

    console.log("== הזמנה חדשה ==");
    console.log("מקור/סקשן:", source || "site", section || "");
    console.log("לקוח:", customerDetails);
    console.log("פריטים:", cart);
    console.log("Totals:", totals);

    const to = process.env.MY_EMAIL || process.env.SMTP_USER;
    const subject = "🛍️ התקבלה הזמנה חדשה מהאתר";

    const cartLines = cart
      .map((i, idx) => {
        const qty = i.quantity || 1;
        return `${idx + 1}. ${i.title} | מידה: ${
          i.size || "—"
        } | כמות: ${qty} | מחיר יח': ${unitPriceLabel(i)}`;
      })
      .join("\n");

    const text = `
התקבלה הזמנה חדשה:
מקור: ${source || "site"} | סקשן: ${section || ""}

[פרטי לקוח]
שם: ${customerDetails.fullname || "—"}
טלפון: ${customerDetails.phone || "—"}
כתובת: ${customerDetails.street || ""} ${customerDetails.houseNumber || ""}, ${
      customerDetails.city || ""
    } (${customerDetails.zip || ""})
אימייל: ${customerDetails.email || "—"}

[מוצרים]
${cartLines}

סך הכל: ${fmtILS(totals.total)}
`.trim();

    const rowsHtml = cart
      .map(
        (i, idx) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${
              idx + 1
            }</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${
              i.title
            }</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${
              i.size || "—"
            }</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${
              i.quantity || 1
            }</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${unitPriceLabel(
              i
            )}</td>
          </tr>
        `
      )
      .join("");

    const breakdown = (() => {
      const parts = [];
      if (totals.standardQty > 0)
        parts.push(
          `<div>סטנדרטי 80×25: ${totals.standardQty} יח' — ${fmtILS(
            totals.standardSubtotal
          )}</div>`
        );
      if (totals.pairQty > 0)
        parts.push(
          `<div>זוגות 50×40: ${totals.pairQty} סט — ${fmtILS(
            totals.pairSubtotal
          )}</div>`
        );
      if (totals.tripleQty > 0)
        parts.push(
          `<div>שלישיות 80×60: ${totals.tripleQty} סט — ${fmtILS(
            totals.tripleSubtotal
          )}</div>`
        );
      if (totals.otherSubtotal > 0)
        parts.push(`<div>מוצרים אחרים: ${fmtILS(totals.otherSubtotal)}</div>`);
      return parts.length
        ? `<h4 style="margin:16px 0 6px;">פירוט חישוב קאנבסים</h4><div style="line-height:1.7;">${parts.join(
            ""
          )}</div>`
        : "";
    })();

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:700px;color:#111;" dir="rtl">
        <h2 style="margin:0 0 12px;">התקבלה הזמנה חדשה מהאתר</h2>
        ${
          source || section
            ? `<div style="color:#666;font-size:12px;margin-bottom:8px;">מקור: ${
                source || "site"
              }${section ? " | " + section : ""}</div>`
            : ""
        }

        <h3 style="margin:12px 0 6px;">פרטי לקוח</h3>
        <div style="background:#f7f7f7;padding:12px;border-radius:8px;line-height:1.7;">
          <div><b>שם מלא:</b> ${customerDetails.fullname || "—"}</div>
          <div><b>טלפון:</b> ${customerDetails.phone || "—"}</div>
          <div><b>כתובת:</b> ${customerDetails.street || "—"} ${
      customerDetails.houseNumber || ""
    }, ${customerDetails.city || "—"}</div>
          ${
            customerDetails.zip
              ? `<div><b>מיקוד:</b> ${customerDetails.zip}</div>`
              : ""
          }
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
              <td style="padding:10px;text-align:right;font-weight:bold;">${fmtILS(
                totals.total
              )}</td>
            </tr>
          </tfoot>
        </table>

        ${breakdown}

        <p style="font-size:12px;color:#666;margin-top:10px;">הודעת מייל זו נשלחה אוטומטית מהשרת.</p>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.MY_EMAIL, 
      to, 
      replyTo: customerDetails?.email || undefined,
      subject,
      text,
      html,
    });

    return res.status(201).json({
      message: "ההזמנה נקלטה ונשלחה למייל בהצלחה!",
      totals,
    });
  } catch (err) {
    console.error("שגיאה בקבלת הזמנה:", err);
    return res.status(500).json({ error: "שגיאה בשרת" });
  }
};

router.post("/orders", createOrderHandler);
router.post("/", createOrderHandler);

export default router;
