import express from "express";
import { Order } from "./order.model.js";
import {
  hypApiSignSign,
  hypApiSignVerify,
  buildReturnUrls,
} from "../services/hypay.service.js";
import {
  getTransport,
  getMailMeta,
  formatAdminOrderEmail,
  formatCustomerOrderEmail,
} from "./orders.mailer.js";

const router = express.Router();

const fmtILS = (n) => {
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Number(n).toFixed(0)}₪`;
  }
};

function createHypOrderId() {
  return `ORD-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function isSuccessfulCCode(ccode) {
  const v = String(ccode ?? "").trim();
  return v === "0" || v === "000";
}

function pickOrderId(q, data) {
  return String(
    q?.Order || q?.order || data?.Order || data?.order || data?.orderId || "",
  ).trim();
}

function pickCCode(q, data) {
  const v = data?.CCode ?? data?.ccode ?? q?.CCode ?? q?.ccode;
  return v === undefined || v === null ? "" : String(v);
}

function computeCanvasTotals(cart = []) {
  let standardQty = 0;
  let pairQty = 0;
  let tripleQty = 0;
  let otherSubtotal = 0;

  for (const item of cart) {
    const qty = Number(item.quantity || 1);
    const price = Number(item.price || 0);
    const cat = String(item.category || item.type || "").toLowerCase();

    if (cat === "standard") standardQty += qty;
    else if (cat === "pair") pairQty += qty;
    else if (cat === "triple") tripleQty += qty;
    else otherSubtotal += price * qty;
  }

  const standardPrice = 200;
  const pairPrice = 300;
  const triplePrice = 400;

  const standardSubtotal = standardQty * standardPrice;
  const pairSubtotal = pairQty * pairPrice;
  const tripleSubtotal = tripleQty * triplePrice;

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

async function maybeSendEmails(order) {
  const transporter = getTransport();
  const meta = getMailMeta();

  if (!order.adminMailSent) {
    try {
      const email = formatAdminOrderEmail(order, fmtILS);
      await transporter.sendMail({
        from: meta.from,
        to: meta.to,
        subject: email.subject,
        html: email.html,
      });
      order.adminMailSent = true;
      order.adminMailError = "";
    } catch (e) {
      order.adminMailError = String(e?.message || e);
    }
  }

  const customerEmail = String(order.customerDetails?.email || "").trim();
  if (customerEmail && !order.customerMailSent) {
    try {
      const email = formatCustomerOrderEmail(order, fmtILS);
      await transporter.sendMail({
        from: meta.from,
        to: customerEmail,
        subject: email.subject,
        html: email.html,
      });
      order.customerMailSent = true;
      order.customerMailError = "";
    } catch (e) {
      order.customerMailError = String(e?.message || e);
    }
  }

  await order.save();
}

router.post("/checkout", async (req, res) => {
  try {
    const { cart = [], customerDetails = {}, section = "" } = req.body || {};
    if (!Array.isArray(cart) || cart.length === 0)
      return res.status(400).json({ ok: false, message: "Cart is empty" });

    const { fullname, phone, city, street, houseNumber } =
      customerDetails || {};
    if (!fullname || !phone || !city || !street || !houseNumber) {
      return res
        .status(400)
        .json({ ok: false, message: "Missing customer details" });
    }

    const totals = computeCanvasTotals(cart);
    if (!totals.total || totals.total <= 0)
      return res.status(400).json({ ok: false, message: "Invalid total" });

    const orderId = createHypOrderId();

    await Order.create({
      source: "site",
      section,
      customerDetails,
      cart,
      totals,
      payment: { provider: "hyp", orderId },
      status: "pending_payment",
    });

    const amountMinor = Math.round(Number(totals.total) * 100);
    const { successUrl, failureUrl, cancelUrl } = buildReturnUrls();

    const signRes = await hypApiSignSign({
      orderId,
      info: `Order ${orderId}`,
      amount: amountMinor,
      coin: 1,
      pageLang: "HEB",
      moreData: true,
      fixTash: true,
      tash: 1,
      sendHesh: false,
      sendEmail: false,
      pritim: true,
      clientName: String(customerDetails.fullname || "").split(" ")[0] || "",
      clientLName:
        String(customerDetails.fullname || "")
          .split(" ")
          .slice(1)
          .join(" ") || "",
      phone: customerDetails.phone || "",
      cell: customerDetails.phone || "",
      email: customerDetails.email || "",
      street: customerDetails.street || "",
      city: customerDetails.city || "",
      zip: customerDetails.zip || "",
      tmp: 1,
    });

    const { data } = signRes;

    const basePaymentUrl = `${process.env.HYP_BASE_URL}?action=pay&Masof=${process.env.HYP_MASOF}`;
    const paymentUrl =
      `${basePaymentUrl}` +
      `&Order=${encodeURIComponent(orderId)}` +
      `&info=${encodeURIComponent(`Order ${orderId}`)}` +
      `&Amount=${encodeURIComponent(amountMinor)}` +
      `&Coin=1` +
      `&PageLang=HEB` +
      `&Sign=${encodeURIComponent(data.signature)}` +
      `&successUrl=${encodeURIComponent(successUrl)}` +
      `&failureUrl=${encodeURIComponent(failureUrl)}` +
      `&cancelUrl=${encodeURIComponent(cancelUrl)}`;

    return res.json({ ok: true, paymentUrl, orderId });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: err.message || "Checkout failed" });
  }
});

router.get("/confirm-payment", async (req, res) => {
  try {
    const orderId = pickOrderId(req.query, null);
    const ccodeIncoming = pickCCode(req.query, null);

    if (!orderId)
      return res.status(400).json({ ok: false, message: "Missing order id" });
    if (!ccodeIncoming)
      return res.status(400).json({ ok: false, message: "Missing CCode" });

    let verifyData = null;
    try {
      const verifyRes = await hypApiSignVerify(req.query || {});
      verifyData = verifyRes?.data || null;
    } catch (e) {
      return res
        .status(400)
        .json({ ok: false, message: "Verification failed" });
    }

    const ccode = pickCCode(req.query, verifyData);
    const success = isSuccessfulCCode(ccode);

    const order = await Order.findOne({ "payment.orderId": orderId });
    if (!order)
      return res.status(404).json({ ok: false, message: "Order not found" });

    order.payment = {
      ...(order.payment || {}),
      orderId,
      ccode: String(ccode ?? ""),
      transactionId: String(
        verifyData?.TranId || verifyData?.Id || verifyData?.dealId || "",
      ),
      raw: verifyData,
      verifiedAt: new Date(),
    };

    if (success) order.status = "paid";
    else order.status = "failed";

    await order.save();

    if (success) {
      await maybeSendEmails(order);
    }

    return res.json({ ok: true, orderId, success, status: order.status });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: err.message || "Verify failed" });
  }
});

router.post("/dev/mark-paid/:orderId", async (req, res) => {
  try {
    const devKey = String(process.env.DEV_ORDER_KEY || "").trim();
    const headerKey = String(req.headers["x-dev-key"] || "").trim();

    if (!devKey || headerKey !== devKey)
      return res.status(403).json({ ok: false, message: "Forbidden" });

    const orderId = String(req.params.orderId || "").trim();
    const order = await Order.findOne({ "payment.orderId": orderId });
    if (!order)
      return res.status(404).json({ ok: false, message: "Order not found" });

    order.status = "paid";
    await order.save();

    await maybeSendEmails(order);

    return res.json({
      ok: true,
      orderId,
      status: order.status,
      adminMailSent: order.adminMailSent,
      customerMailSent: order.customerMailSent,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: err.message || "Failed" });
  }
});

router.get("/status/:orderId", async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId)
      return res.status(400).json({ ok: false, message: "Missing orderId" });

    const order = await Order.findOne({ "payment.orderId": orderId }).lean();
    if (!order)
      return res.status(404).json({ ok: false, message: "Order not found" });

    return res.json({
      ok: true,
      orderId,
      status: order.status,
      adminMailSent: !!order.adminMailSent,
      customerMailSent: !!order.customerMailSent,
      adminMailError: String(order.adminMailError || ""),
      customerMailError: String(order.customerMailError || ""),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: err.message || "Failed" });
  }
});

export default router;
