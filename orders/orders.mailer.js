import nodemailer from "nodemailer";

const ADMIN_EMAIL = String(
  process.env.ADMIN_EMAIL || process.env.MY_EMAIL || "",
).trim();
const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || "")
    .trim()
    .toLowerCase() === "true" || SMTP_PORT === 465;
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").trim();
const SMTP_FROM = String(
  process.env.SMTP_FROM || process.env.MY_EMAIL || SMTP_USER || "",
).trim();

export function getTransport() {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  const gmailUser = String(process.env.MY_EMAIL || "").trim();
  const gmailPass = String(process.env.MY_EMAIL_PASSWORD || "").trim();
  if (gmailUser && gmailPass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });
  }

  throw new Error("Missing SMTP credentials");
}

export function getMailMeta() {
  const to = ADMIN_EMAIL;
  const from = SMTP_FROM || ADMIN_EMAIL;
  if (!to) throw new Error("Missing ADMIN_EMAIL/MY_EMAIL");
  return { to, from };
}

export function formatAdminOrderEmail(order, fmtILS) {
  const cd = order.customerDetails || {};
  const orderId = order.payment?.orderId || order._id.toString();
  const address =
    `${cd.street || ""} ${cd.houseNumber || ""}, ${cd.city || ""}`.trim();

  const itemsRows = (order.cart || [])
    .map((it) => {
      const title = it.title || "";
      const size = it.size ? ` (${it.size})` : "";
      const qty = Number(it.quantity || 1);
      const price = Number(it.price || 0);
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${title}${size}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:left;">${fmtILS(price * qty)}</td>
      </tr>`;
    })
    .join("");

  const t = order.totals || {};
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45;color:#111;">
    <h2 style="margin:0 0 10px;">התקבלה הזמנה חדשה ✅</h2>

    <div style="background:#f6f6f6;border-radius:10px;padding:12px 14px;margin:0 0 14px;">
      <div><strong>מספר הזמנה:</strong> ${orderId}</div>
      <div><strong>שם:</strong> ${cd.fullname || ""}</div>
      <div><strong>טלפון:</strong> ${cd.phone || ""}</div>
      ${cd.email ? `<div><strong>אימייל:</strong> ${cd.email}</div>` : ""}
      <div><strong>כתובת:</strong> ${address}</div>
      ${cd.notes ? `<div><strong>הערות:</strong> ${cd.notes}</div>` : ""}
      <div><strong>סטטוס:</strong> ${order.status}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:0 0 12px;">
      <thead>
        <tr>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd;">פריט</th>
          <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #ddd;">כמות</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #ddd;">סה"כ</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div style="display:flex;justify-content:space-between;max-width:420px;margin-left:auto;">
      <div style="text-align:right;">
        <div>סכום ביניים</div>
        <div>משלוח</div>
        <div style="font-size:18px;"><strong>לתשלום</strong></div>
      </div>
      <div style="text-align:left;">
        <div>${fmtILS(t.subtotal || 0)}</div>
        <div>${fmtILS(t.shipping || 0)}</div>
        <div style="font-size:18px;"><strong>${fmtILS(t.total || 0)}</strong></div>
      </div>
    </div>
  </div>
  `;

  return { subject: `הזמנה חדשה ${orderId}`, html };
}

export function formatCustomerOrderEmail(order, fmtILS) {
  const cd = order.customerDetails || {};
  const name = cd.fullname || "";
  const orderId = order.payment?.orderId || order._id.toString();

  const itemsRows = (order.cart || [])
    .map((it) => {
      const title = it.title || "";
      const size = it.size ? ` (${it.size})` : "";
      const qty = Number(it.quantity || 1);
      const price = Number(it.price || 0);
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${title}${size}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${qty}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:left;">${fmtILS(price * qty)}</td>
      </tr>`;
    })
    .join("");

  const t = order.totals || {};
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.45;color:#111;">
    <h2 style="margin:0 0 10px;">אישור הזמנה ✅</h2>
    <div style="margin:0 0 14px;">היי ${name}, תודה על ההזמנה! קיבלנו את התשלום בהצלחה.</div>

    <div style="background:#f6f6f6;border-radius:10px;padding:12px 14px;margin:0 0 14px;">
      <div><strong>מספר הזמנה:</strong> ${orderId}</div>
    </div>

    <table style="width:100%;border-collapse:collapse;margin:0 0 12px;">
      <thead>
        <tr>
          <th style="text-align:right;padding:6px 8px;border-bottom:2px solid #ddd;">פריט</th>
          <th style="text-align:center;padding:6px 8px;border-bottom:2px solid #ddd;">כמות</th>
          <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #ddd;">סה"כ</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div style="display:flex;justify-content:space-between;max-width:420px;margin-left:auto;">
      <div style="text-align:right;">
        <div>סכום ביניים</div>
        <div>משלוח</div>
        <div style="font-size:18px;"><strong>לתשלום</strong></div>
      </div>
      <div style="text-align:left;">
        <div>${fmtILS(t.subtotal || 0)}</div>
        <div>${fmtILS(t.shipping || 0)}</div>
        <div style="font-size:18px;"><strong>${fmtILS(t.total || 0)}</strong></div>
      </div>
    </div>

    <div style="margin-top:16px;">שמרנו את ההזמנה במערכת. אם צריך משהו, אפשר לענות למייל הזה.</div>
  </div>
  `;

  return { subject: `אישור הזמנה ${orderId}`, html };
}
