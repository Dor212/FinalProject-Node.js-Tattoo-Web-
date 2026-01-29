import nodemailer from "nodemailer";

function boolEnv(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "true") return true;
  if (s === "false") return false;
  return null;
}

function normalizeFrom(fromRaw, fallbackEmail) {
  const from = String(fromRaw || "").trim();
  if (!from) return fallbackEmail;
  return from.replace("<SMTP_USER>", `<${fallbackEmail}>`);
}

export function smtpEnabled() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  return Boolean(host && user && pass);
}

export function createTransport() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = boolEnv(process.env.SMTP_SECURE);
  const resolvedSecure = secure === null ? port === 465 : secure;

  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "")
    .replace(/\s+/g, "")
    .trim();

  return nodemailer.createTransport({
    host,
    port,
    secure: resolvedSecure,
    auth: { user, pass },
    requireTLS: !resolvedSecure,
    tls: { servername: host },
  });
}

export function getMailMeta() {
  const smtpUser = String(process.env.SMTP_USER || "").trim();
  const to = String(process.env.MY_EMAIL || "").trim();
  const from = normalizeFrom(
    process.env.SMTP_FROM,
    smtpUser || "no-reply@example.com",
  );
  return { from, to };
}
