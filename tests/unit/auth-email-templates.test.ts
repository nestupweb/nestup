// @vitest-environment node
import { describe, expect, test } from "vitest";
import { REDIRECT_URLS, SITE_URL, buildAuthConfig, readTemplates, smtpFromEnv } from "../../scripts/auth-config.mjs";

/**
 * The auth e-mails must bring people back to the live site through
 * /auth/confirm with a token hash (works from any device, no PKCE cookie
 * needed) — never through Supabase's default {{ .ConfirmationURL }}, which
 * bounces via the project's Site URL, and never to localhost.
 */
const templates = readTemplates();

describe("auth e-mail templates", () => {
  test("recovery links to /auth/confirm?token_hash&type=recovery on the site", () => {
    expect(templates.recovery).toContain("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery");
    expect(templates.recovery).not.toContain("ConfirmationURL");
    expect(templates.recovery).not.toContain("localhost");
    expect(templates.recovery).toContain("{{ .Email }}");
  });

  test("signup confirmation links to /auth/confirm?token_hash&type=email", () => {
    expect(templates.confirmation).toContain("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email");
    expect(templates.confirmation).not.toContain("ConfirmationURL");
    expect(templates.confirmation).not.toContain("localhost");
  });

  test("both are self-contained HTML in the brand colours", () => {
    for (const html of Object.values(templates)) {
      expect(html).toMatch(/^<!doctype html>/i);
      expect(html).toContain("#2e7d5e");
      expect(html).toContain('<img src="{{ .SiteURL }}/brand/nestup-wordmark-email.png"');
      expect(html).not.toMatch(/<script/i);
    }
  });
});

describe("buildAuthConfig", () => {
  test("site URL is the Vercel domain and the allow-list covers it plus localhost", () => {
    expect(SITE_URL).toBe("https://nestup-kappa.vercel.app");
    expect(REDIRECT_URLS).toEqual(["https://nestup-kappa.vercel.app/**", "http://localhost:3000/**"]);
    const c = buildAuthConfig({ templates });
    expect(c.site_url).toBe(SITE_URL);
    expect(c.uri_allow_list).toBe("https://nestup-kappa.vercel.app/**,http://localhost:3000/**");
    expect(c.mailer_templates_recovery_content).toBe(templates.recovery);
    expect(c.mailer_templates_confirmation_content).toBe(templates.confirmation);
    expect(c.mailer_subjects_recovery).toMatch(/NestUp/);
    expect(c).not.toHaveProperty("smtp_host");
  });

  test("SMTP is included only when the env is complete", () => {
    expect(smtpFromEnv({ SMTP_HOST: "smtp.gmail.com" })).toBeNull();
    const smtp = smtpFromEnv({ SMTP_HOST: "smtp.gmail.com", SMTP_USER: "me@gmail.com", SMTP_PASS: "app-pass", SMTP_SENDER_EMAIL: "me@gmail.com" });
    expect(smtp).toMatchObject({ host: "smtp.gmail.com", port: 587, senderName: "NestUp" });
    const c = buildAuthConfig({ templates, smtp });
    expect(c).toMatchObject({ smtp_host: "smtp.gmail.com", smtp_port: "587", smtp_user: "me@gmail.com", smtp_pass: "app-pass", smtp_admin_email: "me@gmail.com", smtp_sender_name: "NestUp", smtp_max_frequency: 60, rate_limit_email_sent: 60 });
  });
});
