#!/usr/bin/env node
/**
 * NestUp's Supabase Auth settings as code: Site URL, redirect allow-list, the
 * branded e-mail templates in `supabase/templates/` and (when the SMTP_* vars
 * are set) the custom SMTP server used to send them. Applied through the
 * Supabase Management API, so the dashboard never has to be clicked by hand.
 *
 *   node --env-file=.env.local scripts/auth-config.mjs            # dry run: show what would change
 *   node --env-file=.env.local scripts/auth-config.mjs --apply    # write the settings
 *   node --env-file=.env.local scripts/auth-config.mjs --show     # print the live settings
 *
 * Needs SUPABASE_ACCESS_TOKEN (a personal access token from
 * https://supabase.com/dashboard/account/tokens) in .env.local. Optional:
 * SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_SENDER_EMAIL,
 * SMTP_SENDER_NAME (default "NestUp"). Secrets never leave .env.local.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_REF = "eiykciushbnbwpxpvybi";
export const SITE_URL = "https://nestup-kappa.vercel.app";
/** Where an emailed link may come back to; `**` covers every path on the host. */
export const REDIRECT_URLS = [`${SITE_URL}/**`, "http://localhost:3000/**"];
export const SUBJECTS = {
  recovery: "Reset your NestUp password",
  confirmation: "Confirm your NestUp email",
};

const here = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(here, "..", "supabase", "templates");

export function readTemplates(dir = templatesDir) {
  return {
    recovery: readFileSync(join(dir, "recovery.html"), "utf8"),
    confirmation: readFileSync(join(dir, "confirmation.html"), "utf8"),
  };
}

/**
 * SMTP settings from the environment, or null when they're incomplete.
 * @param {Record<string, string | undefined>} [env]
 */
export function smtpFromEnv(env = process.env) {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  const sender = env.SMTP_SENDER_EMAIL?.trim();
  if (!host || !user || !pass || !sender) return null;
  return {
    host,
    port: Number(env.SMTP_PORT || 587),
    user,
    pass,
    sender,
    senderName: env.SMTP_SENDER_NAME?.trim() || "NestUp",
  };
}

/**
 * The Management API body (`PATCH /v1/projects/{ref}/config/auth`).
 * @param {{ templates: { recovery: string; confirmation: string }; smtp?: ReturnType<typeof smtpFromEnv> }} input
 */
export function buildAuthConfig({ templates, smtp = null }) {
  /** @type {Record<string, string | number>} */
  const config = {
    site_url: SITE_URL,
    uri_allow_list: REDIRECT_URLS.join(","),
    mailer_subjects_recovery: SUBJECTS.recovery,
    mailer_templates_recovery_content: templates.recovery,
    mailer_subjects_confirmation: SUBJECTS.confirmation,
    mailer_templates_confirmation_content: templates.confirmation,
    // Sign-up confirms with a 6-digit code typed into six boxes on the site
    // (`{{ .Token }}` in the template). Supabase defaults to 8, which would
    // silently overflow the boxes.
    mailer_otp_length: 6,
  };
  if (smtp) {
    Object.assign(config, {
      smtp_host: smtp.host,
      smtp_port: String(smtp.port),
      smtp_user: smtp.user,
      smtp_pass: smtp.pass,
      smtp_admin_email: smtp.sender,
      smtp_sender_name: smtp.senderName,
      // Our own server: one message per address per minute, 60 an hour
      // project-wide. The hourly cap is shared by sign-up, resend, password
      // reset and e-mail change, and 30 was low enough that a demo with a
      // room full of people testing could wall — the real ceiling is Gmail's
      // own ~500/day, well above this.
      smtp_max_frequency: 60,
      rate_limit_email_sent: 60,
    });
  }
  return config;
}

const SHOWN = [
  "site_url",
  "uri_allow_list",
  "mailer_subjects_recovery",
  "mailer_subjects_confirmation",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_admin_email",
  "smtp_sender_name",
  "smtp_max_frequency",
  "rate_limit_email_sent",
  "mailer_otp_exp",
  "mailer_otp_length",
  "mailer_autoconfirm",
  "external_email_enabled",
];

function endpoint() {
  return `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
}

async function request(method, token, body) {
  const res = await fetch(endpoint(), {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint()} → ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

function summarize(config, wanted) {
  const lines = [];
  for (const key of SHOWN) {
    if (!(key in config) && !(wanted && key in wanted)) continue;
    const live = config[key];
    const next = wanted?.[key];
    const changed = wanted && key in wanted && String(next) !== String(live);
    lines.push(`${changed ? "*" : " "} ${key}: ${JSON.stringify(live)}${changed ? `  →  ${JSON.stringify(next)}` : ""}`);
  }
  if (wanted) {
    for (const key of ["mailer_templates_recovery_content", "mailer_templates_confirmation_content"]) {
      const same = (config[key] ?? "") === wanted[key];
      lines.push(`${same ? " " : "*"} ${key}: ${same ? "up to date" : `${(config[key] ?? "").length} chars  →  ${wanted[key].length} chars`}`);
    }
    lines.push(`  smtp_pass: ${"smtp_pass" in wanted ? "(from SMTP_PASS)" : "(unchanged)"}`);
  }
  return lines.join("\n");
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error("SUPABASE_ACCESS_TOKEN is missing — create one at https://supabase.com/dashboard/account/tokens and put it in .env.local");
    process.exit(2);
  }
  const live = await request("GET", token);
  if (args.has("--show")) {
    console.log(summarize(live));
    return;
  }
  const smtp = smtpFromEnv();
  const wanted = buildAuthConfig({ templates: readTemplates(), smtp });
  console.log(smtp ? `SMTP: ${smtp.user}@${smtp.host}:${smtp.port} as "${smtp.senderName} <${smtp.sender}>"` : "SMTP: not set (SMTP_* vars missing) — Supabase's built-in dev mailer stays");
  console.log(summarize(live, wanted));
  if (!args.has("--apply")) {
    console.log("\nDry run. Re-run with --apply to write these settings.");
    return;
  }
  await request("PATCH", token, wanted);
  const after = await request("GET", token);
  const pending = Object.entries(wanted).filter(([k, v]) => k !== "smtp_pass" && String(after[k]) !== String(v)).map(([k]) => k);
  if (pending.length) throw new Error(`Applied, but these fields still differ: ${pending.join(", ")}`);
  console.log("\nApplied. Live settings now match.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
