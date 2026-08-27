import type { Listing } from "@/lib/types";

/**
 * The "a new room matches you" e-mail.
 *
 * The markup lives here rather than in `supabase/templates/` (which holds the
 * templates Supabase Auth renders on its own servers) because this one is sent
 * by the app: keeping it as a module means Vercel bundles it with the function,
 * where a `readFileSync` of an untraced .html file would not survive the build.
 *
 * Table layout and inline styles throughout — the same shape as
 * `supabase/templates/recovery.html`, and the only thing mail clients render
 * reliably.
 */
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function newMatchSubject(listing: Listing): string {
  return `A new room in ${listing.city} matches what you're looking for`;
}

/**
 * The plain-text half of the multipart message. Written by hand rather than
 * stripped from the HTML: this is what a text-only client shows, and it is
 * read by spam filters as the honest version of the message.
 */
export function renderNewMatchText(listing: Listing, site: string): string {
  const base = site.replace(/\/$/, "");
  return [
    `A room just went up in ${listing.city}.`,
    "",
    listing.title,
    `₪${listing.rent.toLocaleString("en-US")} a month · ${listing.city}`,
    "",
    `See the room: ${base}/browse/${listing.id}`,
    "",
    "It's in one of your cities, inside your budget, and a good match for how you live,",
    "so it's in your Swipe deck too.",
    "",
    `You asked to hear about new matches. Turn these e-mails off: ${base}/settings`,
    "NestUp · find your next home and the people in it",
  ].join("\n");
}

export function renderNewMatch(listing: Listing, site: string): string {
  const base = site.replace(/\/$/, "");
  const url = `${base}/browse/${listing.id}`;
  const settings = `${base}/settings`;
  const title = escapeHtml(listing.title);
  const city = escapeHtml(listing.city);
  const rent = listing.rent.toLocaleString("en-US");
  const photo = listing.photo_urls?.[0] ?? "";
  const photoBlock = photo
    ? `<a href="${url}" style="text-decoration:none;display:block;margin:0 0 20px;"><img src="${escapeHtml(photo)}" width="456" alt="${title}" style="display:block;border:0;width:100%;max-width:456px;height:auto;border-radius:14px;" /></a>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#faf7f2;font-family:Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#201d1a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${title} &middot; &#8362;${rent} a month in ${city}.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#faf7f2;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 8px 20px;">
                <a href="${base}" style="text-decoration:none;display:inline-block;"><img src="${base}/brand/nestup-wordmark-email.png" width="112" height="38" alt="NestUp" style="display:block;border:0;width:112px;height:auto;" /></a>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid rgba(32,29,26,0.1);border-radius:20px;padding:36px 32px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:rgba(32,29,26,0.68);">New match</p>
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.01em;color:#201d1a;">A room just went up in ${city}</h1>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:rgba(32,29,26,0.8);">
                  It&rsquo;s in one of your cities, inside your budget, and a good match for how you live &mdash; so it&rsquo;s in your Swipe deck too.
                </p>
                ${photoBlock}
                <p style="margin:0 0 4px;font-size:17px;font-weight:700;line-height:1.35;color:#201d1a;">${title}</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:rgba(32,29,26,0.68);">&#8362;${rent} a month &middot; ${city}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:999px;background:#2e7d5e;">
                      <a href="${url}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#2e7d5e;color:#faf7f2;font-size:14px;font-weight:700;letter-spacing:0.02em;text-decoration:none;">See the room</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:rgba(32,29,26,0.55);word-break:break-all;">
                  If the button doesn&rsquo;t open, copy this link into your browser:<br />
                  <a href="${url}" style="color:#2e7d5e;">${url}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 0;font-size:12px;line-height:1.5;color:rgba(32,29,26,0.55);">
                You asked to hear about new matches. <a href="${settings}" style="color:#2e7d5e;">Turn these e-mails off</a> in Settings whenever you like.<br />
                NestUp &middot; find your next home and the people in it
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
