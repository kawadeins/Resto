import { Resend } from "resend";
import { db } from "@workspace/db";
import { notificationLogsTable } from "@workspace/db";

const EMAIL_ENABLED = !!process.env.RESEND_API_KEY;
const resend = EMAIL_ENABLED ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.FROM_EMAIL ?? "reminders@restosmart.app";

export async function sendShiftMorningReminder(opts: {
  employeeEmail: string;
  employeeName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  confirmUrl: string;
  shiftId: number;
}) {
  const subject = `Your shift today: ${opts.startTime}–${opts.endTime}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px">
      <h2 style="color:#111827;margin:0 0 12px">Hi ${opts.employeeName},</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">
        You have a shift today from <strong>${opts.startTime}</strong> to <strong>${opts.endTime}</strong>.
        Please arrive on time and confirm your attendance below — it helps your manager plan the day.
      </p>
      <a href="${opts.confirmUrl}"
         style="display:inline-block;padding:13px 28px;background:#16a34a;color:#fff;border-radius:8px;font-size:15px;text-decoration:none;font-weight:600;letter-spacing:0.01em">
        I'm Here — Confirm Arrival
      </a>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #f3f4f6;padding-top:16px">
        RestoSmart &bull; This is an automated shift reminder. If you believe this was sent in error, contact your manager.
      </p>
    </div>
  `;

  let status: "sent" | "failed" | "skipped" = "skipped";
  let errorMessage: string | undefined;

  if (EMAIL_ENABLED && resend) {
    try {
      await resend.emails.send({ from: FROM_EMAIL, to: opts.employeeEmail, subject, html });
      status = "sent";
    } catch (err: any) {
      status = "failed";
      errorMessage = err?.message ?? "Unknown error";
    }
  }

  await db.insert(notificationLogsTable).values({
    type: "shift_morning_reminder",
    recipient: opts.employeeEmail,
    subject,
    status,
    referenceId: String(opts.shiftId),
    errorMessage,
  }).catch(() => {});

  return status;
}

export async function sendShiftPreReminder(opts: {
  employeeEmail: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  confirmUrl: string;
  shiftId: number;
  minutesUntil: number;
}) {
  const subject = `Starting in ${opts.minutesUntil} min: Your shift at ${opts.startTime}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px">
      <h2 style="color:#111827;margin:0 0 12px">Hi ${opts.employeeName},</h2>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">
        Your shift starts in <strong>${opts.minutesUntil} minutes</strong>
        (${opts.startTime}–${opts.endTime}). Head over now and don't forget to confirm when you arrive.
      </p>
      <a href="${opts.confirmUrl}"
         style="display:inline-block;padding:13px 28px;background:#2563eb;color:#fff;border-radius:8px;font-size:15px;text-decoration:none;font-weight:600;letter-spacing:0.01em">
        I'm Here — Confirm Arrival
      </a>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #f3f4f6;padding-top:16px">
        RestoSmart &bull; Automated shift reminder.
      </p>
    </div>
  `;

  let status: "sent" | "failed" | "skipped" = "skipped";
  let errorMessage: string | undefined;

  if (EMAIL_ENABLED && resend) {
    try {
      await resend.emails.send({ from: FROM_EMAIL, to: opts.employeeEmail, subject, html });
      status = "sent";
    } catch (err: any) {
      status = "failed";
      errorMessage = err?.message ?? "Unknown error";
    }
  }

  await db.insert(notificationLogsTable).values({
    type: "shift_pre_reminder",
    recipient: opts.employeeEmail,
    subject,
    status,
    referenceId: String(opts.shiftId),
    errorMessage,
  }).catch(() => {});

  return status;
}

// Generic email sender — logs to notification_logs, never throws
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  type?: string;
  referenceId?: string;
}): Promise<"sent" | "skipped" | "failed"> {
  const type = opts.type ?? "generic";
  let status: "sent" | "skipped" | "failed" = "skipped";
  let errorMessage: string | undefined;

  if (EMAIL_ENABLED && resend) {
    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      status = result.error ? "failed" : "sent";
      if (result.error) errorMessage = result.error.message;
    } catch (err) {
      status = "failed";
      errorMessage = String(err);
    }
  }

  await db.insert(notificationLogsTable).values({
    type,
    recipient: opts.to,
    subject: opts.subject,
    status,
    referenceId: opts.referenceId,
    errorMessage,
  }).catch(() => {});

  return status;
}
