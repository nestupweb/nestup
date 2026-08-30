/**
 * The sign-up confirmation and password-reset e-mails, as modules.
 *
 * These are ports of `supabase/templates/confirmation.html` and
 * `recovery.html`, which Supabase Auth rendered on its own servers. The app
 * sends them itself now (see lib/auth-mail.ts), so the markup has to live
 * somewhere Vercel bundles with the function — the same reason
 * `lib/email/new-match.ts` is a module rather than a file read at runtime.
 *
 * The design is deliberately unchanged from the templates; the one thing that
 * is new is the hand-written plain-text half. Supabase's mailer offered no
 * text part, and an HTML-only message is one of the strongest junk signals a
 * small sender gives off — proven on this project, where the same account sent
 * one multipart message to the inbox and one HTML-only message to spam within
 * a minute of each other.
 *
 * `supabase/templates/` is kept in the repo, and `scripts/auth-config.mjs`
 * still uploads it: it is the fallback Supabase would use if these ever stop
 * being sent, and keeping the two in step costs nothing.
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const BODY = "margin:0;padding:0;background:#faf7f2;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#201d1a;";
const CARD = "background:#ffffff;border:1px solid rgba(32,29,26,0.1);border-radius:20px;padding:36px 32px;";
const EYEBROW = "margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(32,29,26,0.68);";
const H1 = "margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;color:#201d1a;";
const LEAD = "margin:0 0 22px;font-size:15px;line-height:1.55;color:rgba(32,29,26,0.8);";
const SMALL = "margin:18px 0 0;font-size:13px;line-height:1.55;color:rgba(32,29,26,0.68);";
const FOOT = "padding:20px 8px 0;font-size:12px;line-height:1.5;color:rgba(32,29,26,0.55);";

/** The shell every auth mail shares: preheader, wordmark, card, footer. */
function shell(site: string, preheader: string, inner: string): string {
  const host = site.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
  </head>
  <body style="${BODY}">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf7f2;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 8px 20px;">
                <a href="${site}" style="text-decoration:none;display:inline-block;"><img src="${site}/brand/nestup-wordmark-email.png" width="112" height="38" alt="NestUp" style="display:block;border:0;width:112px;height:auto;" /></a>
              </td>
            </tr>
            <tr><td style="${CARD}">${inner}</td></tr>
            <tr>
              <td style="${FOOT}">
                NestUp &middot; find your next home and the people in it &middot; <a href="${site}" style="color:rgba(32,29,26,0.68);">${host}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export const CONFIRMATION_SUBJECT = "Confirm your NestUp email";
export const RECOVERY_SUBJECT = "Reset your NestUp password";
export const EMAIL_CHANGE_SUBJECT = "Confirm your new NestUp email";

export function renderConfirmationText(code: string, email: string, site: string): string {
  return [
    "Thanks for joining NestUp.",
    "",
    `Your confirmation code is: ${code}`,
    "",
    `Type it into the six boxes on the confirmation screen to finish creating ${email}.`,
    `If you closed the tab, open ${site}/verify?email=${encodeURIComponent(email)} and enter it there.`,
    "",
    "The code is good for one hour. Don't share it with anyone — NestUp will never ask you for it.",
    "",
    "If you didn't sign up for NestUp, you can ignore this email — nothing was created without this code.",
    "",
    `NestUp · ${site}`,
  ].join("\n");
}

export function renderConfirmationHtml(code: string, email: string, site: string): string {
  const safeEmail = escapeHtml(email);
  return shell(
    site,
    `Your NestUp confirmation code is ${code}.`,
    `<p style="${EYEBROW}">Welcome</p>
     <h1 style="${H1}">Your confirmation code</h1>
     <p style="${LEAD}">Thanks for joining NestUp. Type this code into the six boxes on the confirmation screen to finish creating <strong style="color:#201d1a;">${safeEmail}</strong>.</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
       <tr>
         <td align="center" style="border:1px solid rgba(46,125,94,0.35);border-radius:16px;background:#f4f8f6;padding:20px 12px;">
           <span style="display:inline-block;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;line-height:1.1;font-weight:700;letter-spacing:0.28em;text-indent:0.28em;color:#2e7d5e;">${escapeHtml(code)}</span>
         </td>
       </tr>
     </table>
     <p style="${SMALL}">The code is good for one hour. Don&rsquo;t share it with anyone &mdash; NestUp will never ask you for it.</p>
     <p style="margin:22px 0 0;font-size:13px;line-height:1.55;color:rgba(32,29,26,0.68);">Closed the tab? <a href="${site}/verify?email=${encodeURIComponent(email)}" style="color:#2e7d5e;font-weight:600;">Open the confirmation screen</a> and enter the code there.</p>
     <p style="${SMALL}">If you didn&rsquo;t sign up for NestUp, you can ignore this email &mdash; nothing was created without this code.</p>`
  );
}

export function renderEmailChangeText(code: string, newEmail: string, site: string): string {
  return [
    `We received a request to change your NestUp sign-in address to ${newEmail}.`,
    "",
    `Your confirmation code is: ${code}`,
    "",
    "Enter it in Settings → Account to finish the switch. Nothing changes until then, and your old address has been told about this request either way.",
    "",
    "The code is good for one hour. Don't share it with anyone — NestUp will never ask you for it.",
    "",
    "If you didn't ask for this, you can ignore this email — your sign-in address stays as it is.",
    "",
    `NestUp · ${site}`,
  ].join("\n");
}

export function renderEmailChangeHtml(code: string, newEmail: string, site: string): string {
  const safeEmail = escapeHtml(newEmail);
  return shell(
    site,
    `Your NestUp confirmation code is ${code}.`,
    `<p style="${EYEBROW}">E-mail change</p>
     <h1 style="${H1}">Your confirmation code</h1>
     <p style="${LEAD}">We received a request to change your NestUp sign-in address to <strong style="color:#201d1a;">${safeEmail}</strong>. Enter this code in Settings &rarr; Account to finish the switch.</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
       <tr>
         <td align="center" style="border:1px solid rgba(46,125,94,0.35);border-radius:16px;background:#f4f8f6;padding:20px 12px;">
           <span style="display:inline-block;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;line-height:1.1;font-weight:700;letter-spacing:0.28em;text-indent:0.28em;color:#2e7d5e;">${escapeHtml(code)}</span>
         </td>
       </tr>
     </table>
     <p style="${SMALL}">The code is good for one hour. Don&rsquo;t share it with anyone &mdash; NestUp will never ask you for it.</p>
     <p style="${SMALL}">If you didn&rsquo;t ask for this, you can ignore this email &mdash; your sign-in address stays as it is. Your old address has been told about this request either way.</p>`
  );
}

export function renderRecoveryText(link: string, email: string, site: string): string {
  return [
    `We received a request to reset the password for ${email}.`,
    "",
    "Open this link to choose a new one:",
    link,
    "",
    "The link works for one hour and can be used once.",
    "",
    "If you didn't ask to reset your password, you can ignore this email — your password stays as it is.",
    "",
    `NestUp · ${site}`,
  ].join("\n");
}

export function renderRecoveryHtml(link: string, email: string, site: string): string {
  const safeLink = escapeHtml(link);
  return shell(
    site,
    "Set a new password for your NestUp account. The link works for one hour.",
    `<p style="${EYEBROW}">Password reset</p>
     <h1 style="${H1}">Set a new password</h1>
     <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:rgba(32,29,26,0.8);">We received a request to reset the password for <strong style="color:#201d1a;">${escapeHtml(email)}</strong>. Tap the button to choose a new one.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" border="0">
       <tr>
         <td style="border-radius:999px;background:#2e7d5e;">
           <a href="${safeLink}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#2e7d5e;color:#faf7f2;font-size:14px;font-weight:700;letter-spacing:0.02em;text-decoration:none;">Set a new password</a>
         </td>
       </tr>
     </table>
     <p style="margin:24px 0 0;font-size:13px;line-height:1.55;color:rgba(32,29,26,0.68);">The link works for one hour and can be used once. If you didn&rsquo;t ask to reset your password, you can ignore this email &mdash; your password stays as it is.</p>
     <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:rgba(32,29,26,0.55);word-break:break-all;">If the button doesn&rsquo;t open, copy this link into your browser:<br /><a href="${safeLink}" style="color:#2e7d5e;">${safeLink}</a></p>`
  );
}
