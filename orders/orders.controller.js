import { Order } from "./order.model.js";
import { buildOrderEmail, computeTotals } from "./orders.service.js";
import { createTransport, getMailMeta, smtpEnabled } from "./orders.mailer.js";

export async function createOrder(req, res) {
  try {
    const { customerDetails, cart, source, section } = req.body || {};

    if (!customerDetails || !Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: "חסרים פרטים להזמנה" });
    }

    const totals = computeTotals(cart);

    const order = await Order.create({
      source: source || "site",
      section: section || "",
      customerDetails,
      cart,
      totals,
      status: "received",
      mailSent: false,
      mailError: null,
    });

    const { subject, text, html } = buildOrderEmail({
      source: order.source,
      section: order.section,
      customerDetails: order.customerDetails,
      cart: order.cart,
      totals: order.totals,
    });

    let mailSent = false;
    let mailError = null;

    const { from, to } = getMailMeta();

    if (!to) {
      mailError = "MY_EMAIL is missing";
    } else if (!smtpEnabled()) {
      mailError = "SMTP not configured";
    } else {
      try {
        const transport = createTransport();
        await transport.sendMail({
          from,
          to,
          subject,
          text,
          html,
          replyTo: order.customerDetails?.email || undefined,
        });
        mailSent = true;
      } catch (e) {
        mailError = e?.message ? String(e.message) : "SMTP send failed";
      }
    }

    order.mailSent = mailSent;
    order.mailError = mailError;
    await order.save();

    return res.status(201).json({
      ok: true,
      orderId: order._id,
      mailSent,
      mailError,
      totals: order.totals,
    });
  } catch (err) {
    return res.status(500).json({ error: "שגיאה בשרת" });
  }
}

export async function listOrders(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(5, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Order.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments({}),
    ]);

    return res.json({ ok: true, page, limit, total, items });
  } catch (err) {
    return res.status(500).json({ error: "שגיאה בשרת" });
  }
}

export async function getOrder(req, res) {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: "Order not found" });
    return res.json({ ok: true, order });
  } catch (err) {
    return res.status(500).json({ error: "שגיאה בשרת" });
  }
}
