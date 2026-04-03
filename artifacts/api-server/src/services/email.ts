/**
 * E-Mail-Benachrichtigungsdienst via Resend.
 * - Fire-and-forget: Fehler werden protokolliert, niemals geworfen.
 * - Anti-Spam: Doppelte Sendungen werden vor jedem Versand geprüft.
 * - Alle E-Mails werden in notification_logs gespeichert.
 */
import { Resend } from "resend";
import { db } from "@workspace/db";
import { notificationLogsTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "RestoSmart <notifications@restosmartapp.com>";
const EMAIL_ENABLED = !!RESEND_API_KEY;

function getResend() {
  return new Resend(RESEND_API_KEY);
}

// ─── Anti-Spam ────────────────────────────────────────────────────────────────
async function isDuplicate(
  type: string,
  recipient: string,
  referenceId: string | null,
  withinMinutes = 60
): Promise<boolean> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);
  const conditions = [
    eq(notificationLogsTable.type, type),
    eq(notificationLogsTable.recipient, recipient),
    eq(notificationLogsTable.status, "sent"),
    gte(notificationLogsTable.createdAt, since),
  ];
  if (referenceId) {
    conditions.push(eq(notificationLogsTable.referenceId, referenceId));
  }
  const existing = await db
    .select({ id: notificationLogsTable.id })
    .from(notificationLogsTable)
    .where(and(...conditions))
    .limit(1);
  return existing.length > 0;
}

// ─── Log-Helfer ───────────────────────────────────────────────────────────────
async function logNotification(
  type: string,
  recipient: string,
  subject: string,
  status: "sent" | "failed" | "skipped",
  referenceId?: string,
  errorMessage?: string
) {
  try {
    await db.insert(notificationLogsTable).values({
      type,
      recipient,
      subject,
      status,
      referenceId: referenceId ?? null,
      errorMessage: errorMessage ?? null,
    });
  } catch {
    // Logging wirft niemals einen Fehler
  }
}

// ─── Basisversand ─────────────────────────────────────────────────────────────
async function send(opts: {
  to: string;
  subject: string;
  html: string;
  type: string;
  referenceId?: string;
  spamWindowMinutes?: number;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!EMAIL_ENABLED) {
    await logNotification(opts.type, opts.to, opts.subject, "skipped", opts.referenceId, "Kein RESEND_API_KEY konfiguriert");
    return { ok: false, skipped: true };
  }

  const dup = await isDuplicate(opts.type, opts.to, opts.referenceId ?? null, opts.spamWindowMinutes ?? 60);
  if (dup) {
    await logNotification(opts.type, opts.to, opts.subject, "skipped", opts.referenceId, "Doppelte Sendung unterdrückt");
    return { ok: true, skipped: true };
  }

  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    if (error) {
      await logNotification(opts.type, opts.to, opts.subject, "failed", opts.referenceId, error.message);
      return { ok: false };
    }

    await logNotification(opts.type, opts.to, opts.subject, "sent", opts.referenceId);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await logNotification(opts.type, opts.to, opts.subject, "failed", opts.referenceId, msg);
    return { ok: false };
  }
}

// ─── Gemeinsames Layout ────────────────────────────────────────────────────────
function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0eef8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0eef8;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(99,60,180,0.10);">
        <!-- Kopfzeile -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#db2777);padding:28px 36px;text-align:center;">
            <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">RestoSmart</span>
          </td>
        </tr>
        <!-- Inhalt -->
        <tr><td style="padding:36px 36px 28px;">${body}</td></tr>
        <!-- Fußzeile -->
        <tr>
          <td style="background:#f9f8ff;padding:20px 36px;text-align:center;border-top:1px solid #ede8f8;">
            <p style="margin:0;font-size:12px;color:#999;">Diese E-Mail wurde gesendet, weil Sie RestoSmart nutzen. Fragen? Antworten Sie einfach auf diese E-Mail.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Buchungsbestätigung ──────────────────────────────────────────────────────
export async function sendBookingConfirmation(booking: {
  id: number;
  customerName: string;
  customerEmail: string;
  date: string;
  time: string;
  partySize: number;
  restaurantName?: string;
  notes?: string | null;
}) {
  const subject = `Buchung bestätigt — ${booking.date} um ${booking.time} Uhr`;
  const restaurant = booking.restaurantName ?? "dem Restaurant";

  const body = `
    <h1 style="margin:0 0 4px;font-size:26px;color:#1a0a2e;font-weight:700;">Ihr Tisch ist reserviert!</h1>
    <p style="margin:0 0 28px;color:#888;font-size:15px;">Wir freuen uns auf Ihren Besuch.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8ff;border-radius:12px;border:1px solid #ede8f8;margin-bottom:28px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Reservierungsdetails</p>
          <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1a0a2e;">${restaurant}</p>
          <p style="margin:4px 0;font-size:15px;color:#555;">${booking.date} &nbsp;·&nbsp; ${booking.time} Uhr</p>
          <p style="margin:4px 0;font-size:15px;color:#555;">${booking.partySize} ${booking.partySize === 1 ? "Person" : "Personen"}</p>
          ${booking.notes ? `<p style="margin:8px 0 0;font-size:13px;color:#888;font-style:italic;">"${booking.notes}"</p>` : ""}
        </td>
      </tr>
    </table>

    <p style="font-size:15px;color:#444;line-height:1.6;">Hallo <strong>${booking.customerName}</strong>,<br>
    Ihre Reservierung wurde bestätigt. Falls Sie stornieren oder Änderungen vornehmen möchten, wenden Sie sich bitte so bald wie möglich direkt an das Restaurant.</p>

    <p style="margin:20px 0 0;font-size:13px;color:#888;">Reservierungs-ID: #${booking.id}</p>
  `;

  return send({
    to: booking.customerEmail,
    subject,
    html: layout(subject, body),
    type: "booking_confirmation",
    referenceId: booking.id.toString(),
    spamWindowMinutes: 1440,
  });
}

// ─── Kampagnen-E-Mail ──────────────────────────────────────────────────────────
const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  win_back: "Wir vermissen Sie",
  thank_you: "Danke, dass Sie bei uns gegessen haben",
  flash_blast: "Exklusives Angebot — nur für kurze Zeit",
  loyalty_reward: "Ihre Treue wird belohnt",
};

export async function sendCampaignEmail(opts: {
  campaignId: number;
  campaignType: string;
  customerEmail: string;
  customerName: string;
  messageTemplate: string;
}) {
  const label = CAMPAIGN_TYPE_LABELS[opts.campaignType] ?? "Eine Nachricht von uns";
  const subject = label;

  const body = `
    <h1 style="margin:0 0 20px;font-size:24px;color:#1a0a2e;font-weight:700;">${label}</h1>
    <p style="font-size:16px;color:#444;line-height:1.7;">Hallo <strong>${opts.customerName}</strong>,</p>
    <p style="font-size:16px;color:#444;line-height:1.7;">${opts.messageTemplate}</p>
    <div style="margin:28px 0;">
      <a href="#" style="background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Tisch buchen</a>
    </div>
    <p style="font-size:13px;color:#aaa;margin-top:24px;">Sie erhalten diese Nachricht, weil Sie bereits bei uns gespeist haben. Wir würden uns freuen, Sie wieder begrüßen zu dürfen.</p>
  `;

  return send({
    to: opts.customerEmail,
    subject,
    html: layout(subject, body),
    type: "campaign",
    referenceId: `${opts.campaignId}:${opts.customerEmail}`,
    spamWindowMinutes: 1440,
  });
}

// ─── Treueprogramm — Stufen-Upgrade ──────────────────────────────────────────
export async function sendLoyaltyTierUnlock(opts: {
  customerEmail: string;
  customerName: string;
  tier: string;
  points: number;
}) {
  const tierDE: Record<string, string> = { Bronze: "Bronze", Silver: "Silber", Gold: "Gold" };
  const tierName = tierDE[opts.tier] ?? opts.tier;
  const subject = `Sie haben die ${tierName}-Stufe erreicht!`;

  const tierColors: Record<string, string> = {
    Silver: "#9ca3af",
    Gold: "#d97706",
  };
  const color = tierColors[opts.tier] ?? "#7c3aed";

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:${color}20;border:2px solid ${color};border-radius:50px;padding:8px 24px;">
        <span style="color:${color};font-weight:700;font-size:18px;">${tierName} Mitglied</span>
      </div>
    </div>
    <h1 style="margin:0 0 12px;font-size:24px;color:#1a0a2e;font-weight:700;text-align:center;">Herzlichen Glückwunsch, ${opts.customerName}!</h1>
    <p style="font-size:15px;color:#555;line-height:1.7;text-align:center;">Sie haben mit ${opts.points} Treuepunkten den <strong>${tierName}</strong>-Status freigeschaltet. Vielen Dank, dass Sie zu unseren geschätztesten Gästen gehören.</p>
    <div style="margin:28px 0;text-align:center;">
      <a href="#" style="background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Meine Punkte ansehen</a>
    </div>
  `;

  return send({
    to: opts.customerEmail,
    subject,
    html: layout(subject, body),
    type: "loyalty_tier",
    referenceId: `${opts.customerEmail}:${opts.tier}`,
    spamWindowMinutes: 43200,
  });
}

// ─── Blitzangebot-Benachrichtigung ────────────────────────────────────────────
export async function sendFlashDealAlert(opts: {
  customerEmail: string;
  customerName: string;
  discountPercent: number;
  restaurantName: string;
  expiresAt: Date;
  dealId: number;
}) {
  const expiryStr = opts.expiresAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const subject = `${opts.discountPercent}% Rabatt heute Abend — gültig bis ${expiryStr} Uhr`;

  const body = `
    <div style="background:#fdf0ff;border-left:4px solid #7c3aed;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Blitzangebot — Nur für begrenzte Zeit</p>
    </div>
    <h1 style="margin:0 0 12px;font-size:28px;color:#1a0a2e;font-weight:700;">${opts.discountPercent}% Rabatt auf Ihren nächsten Besuch</h1>
    <p style="font-size:15px;color:#555;line-height:1.7;">Hallo <strong>${opts.customerName}</strong>, wir bieten Ihnen ein exklusives Blitzangebot bei <strong>${opts.restaurantName}</strong> — nur für kurze Zeit. Das Angebot endet heute um ${expiryStr} Uhr.</p>
    <div style="margin:28px 0;">
      <a href="#" style="background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Jetzt buchen &amp; sparen</a>
    </div>
    <p style="font-size:13px;color:#aaa;">Nur gültig für Tischbuchungen. Nicht kombinierbar mit anderen Angeboten.</p>
  `;

  return send({
    to: opts.customerEmail,
    subject,
    html: layout(subject, body),
    type: "flash_deal",
    referenceId: `deal:${opts.dealId}:${opts.customerEmail}`,
    spamWindowMinutes: 120,
  });
}

export { EMAIL_ENABLED };
