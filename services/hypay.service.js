import { URLSearchParams } from "node:url";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function parseQueryLike(text) {
  const params = new URLSearchParams(text.trim());
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

export function buildReturnUrls() {
  const appBase = requireEnv("APP_BASE_URL").replace(/\/+$/, "");
  const successPath = process.env.HYP_SUCCESS_PATH || "/payment/success";
  const failurePath = process.env.HYP_FAILURE_PATH || "/payment/failure";
  const cancelPath = process.env.HYP_CANCEL_PATH || "/payment/cancel";

  return {
    successUrl: `${appBase}${successPath}`,
    failureUrl: `${appBase}${failurePath}`,
    cancelUrl: `${appBase}${cancelPath}`,
  };
}

export async function hypApiSignSign(payload) {
  const baseUrl = requireEnv("HYP_BASE_URL"); 
  const Masof = requireEnv("HYP_MASOF");
  const PassP = requireEnv("HYP_PASSP");
  const KEY = requireEnv("HYP_KEY");

  const params = new URLSearchParams();

  params.set("action", "APISign");
  params.set("What", "SIGN");
  params.set("Masof", Masof);
  params.set("PassP", PassP);
  params.set("KEY", KEY);

  params.set("Order", payload.orderId);
  params.set("Info", payload.info);
  params.set("Amount", String(payload.amount)); 
  params.set("Coin", String(payload.coin ?? 1)); 
  params.set("PageLang", payload.pageLang ?? "HEB"); 

  params.set("UTF8", "True");
  params.set("UTF8out", "True");
  params.set("Sign", "True");

  if (payload.moreData === true) params.set("MoreData", "True");
  if (typeof payload.tash === "number")
    params.set("Tash", String(payload.tash));
  if (payload.fixTash === true) params.set("FixTash", "True");
  if (payload.userId) params.set("UserId", payload.userId);
  if (payload.clientName) params.set("ClientName", payload.clientName);
  if (payload.clientLName) params.set("ClientLName", payload.clientLName);
  if (payload.phone) params.set("phone", payload.phone);
  if (payload.cell) params.set("cell", payload.cell);
  if (payload.email) params.set("email", payload.email);
  if (payload.street) params.set("street", payload.street);
  if (payload.city) params.set("city", payload.city);
  if (payload.zip) params.set("zip", payload.zip);
  if (typeof payload.tmp === "number") params.set("tmp", String(payload.tmp));

  if (payload.sendHesh === true) params.set("SendHesh", "True");
  if (payload.sendEmail === true) params.set("sendemail", "True");
  if (payload.pritim === true) params.set("Pritim", "True");
  if (payload.heshDesc) params.set("heshDesc", payload.heshDesc);

  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Hyp APISign SIGN failed (${res.status}): ${text}`);
  }

  const data = parseQueryLike(text);

  if (!data.signature) {
    throw new Error(
      `Hyp APISign SIGN did not return signature. Check terminal setting "Verify by signature". Response: ${text}`,
    );
  }

  return { raw: text.trim(), data };
}

export async function hypApiSignVerify(queryParams) {
  const baseUrl = requireEnv("HYP_BASE_URL");
  const Masof = requireEnv("HYP_MASOF");
  const PassP = requireEnv("HYP_PASSP");
  const KEY = requireEnv("HYP_KEY");

  const params = new URLSearchParams();

  params.set("action", "APISign");
  params.set("What", "VERIFY");
  params.set("Masof", Masof);
  params.set("PassP", PassP);
  params.set("KEY", KEY);

  for (const [k, v] of Object.entries(queryParams)) {
    if (v == null) continue;
    params.set(k, String(v));
  }

  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Hyp APISign VERIFY failed (${res.status}): ${text}`);
  }

  const data = parseQueryLike(text);
  return { raw: text.trim(), data };
}
