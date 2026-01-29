export function fmtILS(n) {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Number(n || 0).toFixed(0)}₪`;
  }
}

export function computeTotals(cart = []) {
  let standardQty = 0;
  let pairQty = 0;
  let tripleQty = 0;
  let otherSubtotal = 0;

  for (const i of cart) {
    const size = String(i.size || "").trim();
    const cat = String(i.category || "").trim();
    const qty = Number(i.quantity || 1);
    const price = typeof i.price === "number" ? i.price : Number(i.price || 0);

    const isStandard = size === "80×25" || cat === "standard";
    const isPair = size === "50×40" || cat === "pair";
    const isTriple = size === "80×60" || cat === "triple";

    if (isStandard) standardQty += qty;
    else if (isPair) pairQty += qty;
    else if (isTriple) tripleQty += qty;
    else otherSubtotal += price * qty;
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

  const subtotal =
    standardSubtotal + pairSubtotal + tripleSubtotal + otherSubtotal;
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

export function buildOrderEmail({
  source,
  section,
  customerDetails,
  cart,
  totals,
}) {
  const lines = cart
    .map((i, idx) => {
      const qty = Number(i.quantity || 1);
      const size = String(i.size || "—");
      const title = String(i.title || "—");
      const price =
        typeof i.price === "number" ? i.price : Number(i.price || 0);
      const lineTotal = price * qty;
      return `${idx + 1}. ${title} | מידה: ${size} | כמות: ${qty} | שורה: ${fmtILS(lineTotal)}`;
    })
    .join("\n");

  const text = `
התקבלה הזמנה חדשה:
מקור: ${source || "site"} | סקשן: ${section || ""}

[פרטי לקוח]
שם: ${customerDetails.fullname || "—"}
טלפון: ${customerDetails.phone || "—"}
אימייל: ${customerDetails.email || "—"}
כתובת: ${customerDetails.street || ""} ${customerDetails.houseNumber || ""}, ${customerDetails.city || ""} (${customerDetails.zip || ""})
הערות: ${customerDetails.notes || ""}

[פריטים]
${lines}

סה"כ: ${fmtILS(totals.total)}
`.trim();

  const rows = cart
    .map((i, idx) => {
      const qty = Number(i.quantity || 1);
      const price =
        typeof i.price === "number" ? i.price : Number(i.price || 0);
      const lineTotal = price * qty;
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${idx + 1}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${String(i.title || "")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${String(i.size || "—")}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${fmtILS(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:760px;color:#111;" dir="rtl">
      <h2 style="margin:0 0 12px;">התקבלה הזמנה חדשה מהאתר</h2>
      <div style="color:#666;font-size:12px;margin-bottom:10px;">מקור: ${source || "site"} ${section ? `| ${section}` : ""}</div>

      <h3 style="margin:12px 0 8px;">פרטי לקוח</h3>
      <div style="background:#f7f7f7;padding:12px;border-radius:10px;line-height:1.8;">
        <div><b>שם מלא:</b> ${customerDetails.fullname || "—"}</div>
        <div><b>טלפון:</b> ${customerDetails.phone || "—"}</div>
        <div><b>אימייל:</b> ${customerDetails.email || "—"}</div>
        <div><b>כתובת:</b> ${customerDetails.street || "—"} ${customerDetails.houseNumber || ""}, ${customerDetails.city || "—"}</div>
        ${customerDetails.zip ? `<div><b>מיקוד:</b> ${customerDetails.zip}</div>` : ""}
        ${customerDetails.notes ? `<div><b>הערות:</b> ${customerDetails.notes}</div>` : ""}
      </div>

      <h3 style="margin:16px 0 8px;">פריטים</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:8px;text-align:right;border-bottom:1px solid #eee;">#</th>
            <th style="padding:8px;text-align:right;border-bottom:1px solid #eee;">מוצר</th>
            <th style="padding:8px;text-align:center;border-bottom:1px solid #eee;">מידה</th>
            <th style="padding:8px;text-align:center;border-bottom:1px solid #eee;">כמות</th>
            <th style="padding:8px;text-align:right;border-bottom:1px solid #eee;">סה״כ שורה</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding:10px;text-align:left;font-weight:bold;">סה״כ:</td>
            <td style="padding:10px;text-align:right;font-weight:bold;">${fmtILS(totals.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:10px;color:#666;font-size:12px;">מייל זה נשלח אוטומטית מהשרת.</div>
    </div>
  `;

  return { subject: "🛍️ התקבלה הזמנה חדשה", text, html };
}
