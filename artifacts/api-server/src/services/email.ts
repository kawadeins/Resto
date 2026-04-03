/**
 * Email notification service using Resend.
 * - Fire-and-forget: failures are logged, never thrown.
 * - Anti-spam: duplicate sends are checked before each dispatch.
 * - All emails are logged to notification_logs table.
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

// ─── Anti-spam ────────────────────────────────────────────────────────────────
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

// ─── Log helper ───────────────────────────────────────────────────────────────
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
    // Never throw from logging
  }
}

// ─── Base send ────────────────────────────────────────────────────────────────
async function send(opts: {
  to: string;
  subject: string;
  html: string;
  type: string;
  referenceId?: string;
  spamWindowMinutes?: number;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!EMAIL_ENABLED) {
    await logNotification(opts.type, opts.to, opts.subject, "skipped", opts.referenceId, "No RESEND_API_KEY configured");
    return { ok: false, skipped: true };
  }

  const dup = await isDuplicate(opts.type, opts.to, opts.referenceId ?? null, opts.spamWindowMinutes ?? 60);
  if (dup) {
    await logNotification(opts.type, opts.to, opts.subject, "skipped", opts.referenceId, "Duplicate suppressed");
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

// ─── Shared layout ────────────────────────────────────────────────────────────
function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f1ec;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.07);">
        <!-- Header -->
        <tr>
          <td style="background:#1a1107;padding:28px 36px;text-align:center;">
            <span style="color:#e07c3a;font-size:22px;font-weight:700;letter-spacing:-0.5px;">RestoSmart</span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:36px 36px 28px;">${body}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f7f4;padding:20px 36px;text-align:center;border-top:1px solid #ede8e0;">
            <p style="margin:0;font-size:12px;color:#999;">You received this because you use RestoSmart dining. Questions? Reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Booking Confirmation ────────────────────────────────────────────────────
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
  const subject = `Booking confirmed — ${booking.date} at ${booking.time}`;
  const restaurant = booking.restaurantName ?? "the restaurant";

  const body = `
    <h1 style="margin:0 0 4px;font-size:26px;color:#1a1107;font-weight:700;">Your table is booked!</h1>
    <p style="margin:0 0 28px;color:#888;font-size:15px;">We can't wait to see you.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border-radius:8px;border:1px solid #ede8e0;margin-bottom:28px;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Reservation details</p>
          <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#1a1107;">${restaurant}</p>
          <p style="margin:4px 0;font-size:15px;color:#555;">${booking.date} &nbsp;·&nbsp; ${booking.time}</p>
          <p style="margin:4px 0;font-size:15px;color:#555;">${booking.partySize} ${booking.partySize === 1 ? "guest" : "guests"}</p>
          ${booking.notes ? `<p style="margin:8px 0 0;font-size:13px;color:#888;font-style:italic;">"${booking.notes}"</p>` : ""}
        </td>
      </tr>
    </table>

    <p style="font-size:15px;color:#444;line-height:1.6;">Hello <strong>${booking.customerName}</strong>,<br>
    Your reservation has been confirmed. If you need to cancel or make changes, please contact the restaurant directly as soon as possible.</p>

    <p style="margin:20px 0 0;font-size:13px;color:#888;">Reservation ID: #${booking.id}</p>
  `;

  return send({
    to: booking.customerEmail,
    subject,
    html: layout(subject, body),
    type: "booking_confirmation",
    referenceId: booking.id.toString(),
    spamWindowMinutes: 1440, // 24h per booking
  });
}

// ─── Campaign Email ────────────────────────────────────────────────────────────
const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  win_back: "We miss you",
  thank_you: "Thank you for dining with us",
  flash_blast: "Exclusive deal — limited time",
  loyalty_reward: "Your loyalty is rewarded",
};

export async function sendCampaignEmail(opts: {
  campaignId: number;
  campaignType: string;
  customerEmail: string;
  customerName: string;
  messageTemplate: string;
}) {
  const label = CAMPAIGN_TYPE_LABELS[opts.campaignType] ?? "A message from us";
  const subject = label;

  const body = `
    <h1 style="margin:0 0 20px;font-size:24px;color:#1a1107;font-weight:700;">${label}</h1>
    <p style="font-size:16px;color:#444;line-height:1.7;">Hi <strong>${opts.customerName}</strong>,</p>
    <p style="font-size:16px;color:#444;line-height:1.7;">${opts.messageTemplate}</p>
    <div style="margin:28px 0;">
      <a href="#" style="background:#e07c3a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Book a Table</a>
    </div>
    <p style="font-size:13px;color:#aaa;margin-top:24px;">You're receiving this because you've dined with us before. We'd love to see you again.</p>
  `;

  return send({
    to: opts.customerEmail,
    subject,
    html: layout(subject, body),
    type: "campaign",
    referenceId: `${opts.campaignId}:${opts.customerEmail}`,
    spamWindowMinutes: 1440, // 24h per campaign+email
  });
}

// ─── Loyalty Tier Unlock ──────────────────────────────────────────────────────
export async function sendLoyaltyTierUnlock(opts: {
  customerEmail: string;
  customerName: string;
  tier: string;
  points: number;
}) {
  const subject = `You've reached ${opts.tier} tier!`;

  const tierColors: Record<string, string> = {
    Silver: "#9ca3af",
    Gold: "#d97706",
  };
  const color = tierColors[opts.tier] ?? "#6b7280";

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:${color}20;border:2px solid ${color};border-radius:50px;padding:8px 24px;">
        <span style="color:${color};font-weight:700;font-size:18px;">${opts.tier} Member</span>
      </div>
    </div>
    <h1 style="margin:0 0 12px;font-size:24px;color:#1a1107;font-weight:700;text-align:center;">Congratulations, ${opts.customerName}!</h1>
    <p style="font-size:15px;color:#555;line-height:1.7;text-align:center;">You've unlocked <strong>${opts.tier}</strong> status with ${opts.points} loyalty points. Thank you for being one of our most valued guests.</p>
    <div style="margin:28px 0;text-align:center;">
      <a href="#" style="background:#e07c3a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">View Your Rewards</a>
    </div>
  `;

  return send({
    to: opts.customerEmail,
    subject,
    html: layout(subject, body),
    type: "loyalty_tier",
    referenceId: `${opts.customerEmail}:${opts.tier}`,
    spamWindowMinutes: 43200, // 30 days per tier per customer
  });
}

// ─── Flash Deal Alert ─────────────────────────────────────────────────────────
export async function sendFlashDealAlert(opts: {
  customerEmail: string;
  customerName: string;
  discountPercent: number;
  restaurantName: string;
  expiresAt: Date;
  dealId: number;
}) {
  const expiryStr = opts.expiresAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const subject = `${opts.discountPercent}% off tonight — expires at ${expiryStr}`;

  const body = `
    <div style="background:#fff3e0;border-left:4px solid #e07c3a;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#e07c3a;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Flash Deal — Limited Time</p>
    </div>
    <h1 style="margin:0 0 12px;font-size:28px;color:#1a1107;font-weight:700;">${opts.discountPercent}% off your next visit</h1>
    <p style="font-size:15px;color:#555;line-height:1.7;">Hi <strong>${opts.customerName}</strong>, we're offering an exclusive flash deal at <strong>${opts.restaurantName}</strong> for a limited time only. This offer expires at ${expiryStr} tonight.</p>
    <div style="margin:28px 0;">
      <a href="#" style="background:#e07c3a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Book Now &amp; Save</a>
    </div>
    <p style="font-size:13px;color:#aaa;">Offer valid for table bookings only. Cannot be combined with other offers.</p>
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
