/**
 * Trust & Safety Moderation Utility
 * Uses gpt-4o-mini (vision capable) to screen text and images.
 * Integrates with moderation_logs + user_strikes DB tables.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import fs from "fs";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContentType =
  | "post_image"
  | "post_caption"
  | "comment"
  | "message"
  | "bio"
  | "avatar";

export type ModerationSeverity = 0 | 1 | 2 | 3;

export interface ModerationResult {
  safe: boolean;
  severity: ModerationSeverity;
  category: string;
  reason?: string;
  message?: string; // German user-facing message
  blocked: boolean;
}

export interface UserStatus {
  status: "active" | "warned" | "restricted" | "suspended";
  strikeCount: number;
  suspended: boolean;
  restricted: boolean;
}

// ── German user-facing messages ───────────────────────────────────────────────

const BLOCKED_MESSAGES: Record<string, string> = {
  post_image:    "Dieses Bild verstößt gegen unsere Richtlinien und kann nicht hochgeladen werden.",
  post_caption:  "Dieser Inhalt kann nicht veröffentlicht werden. Bitte verwende respektvolle Sprache.",
  comment:       "Dein Kommentar wurde blockiert. Bitte verwende respektvolle Sprache.",
  message:       "Diese Nachricht wurde blockiert. Bitte kommuniziere respektvoll.",
  bio:           "Dein Profiltext verstößt gegen unsere Richtlinien. Bitte ändere ihn.",
  avatar:        "Dieses Profilbild kann nicht hochgeladen werden. Bitte wähle ein geeignetes Bild.",
};

const WARNING_MESSAGES: Record<string, string> = {
  post_image:    "Bitte lade nur für die Plattform geeignete Inhalte hoch.",
  post_caption:  "Bitte verwende respektvolle und angemessene Sprache.",
  comment:       "Bitte bleibe freundlich und respektvoll.",
  message:       "Bitte kommuniziere respektvoll.",
  bio:           "Bitte verwende in deinem Profil angemessene Inhalte.",
  avatar:        "Bitte lade nur geeignete Profilbilder hoch.",
};

// ── Keyword pre-filter (always blocks regardless of AI) ───────────────────────
// German/English patterns that are always severity 3 violations

const BLOCK_PATTERNS: Array<{ pattern: RegExp; category: string; reason: string }> = [
  // Ethnic/racial hate + "raus" combinations
  { pattern: /ausländer\s*raus|ausländer\s*weg/i, category: "hate", reason: "xenophobic slogan" },
  // Common German slurs for foreigners/minorities
  { pattern: /\b(kanake|neger|nigger|zigeuner|judensau|juden\s*raus)\b/i, category: "hate", reason: "racial slur" },
  // Explicit hate combinations: hasse + group
  { pattern: /hasse?\s+(alle\s+)?(ausländer|juden|muslime|türken|araber|schwarze|asiate)/i, category: "hate", reason: "hate speech targeting group" },
  // Nazi slogans / symbols
  { pattern: /\b(heil\s*hitler|sieg\s*heil|1488|88\s*hh)\b/i, category: "hate", reason: "Nazi slogan" },
  // Explicit sexual / pornographic
  { pattern: /\b(porn|fick\s*dich|wichser|hurensohn|schlampe|fotze|arschloch)\b/i, category: "explicit", reason: "explicit/vulgar language" },
  // Death threats
  { pattern: /(ich\s+bringe?\s+dich\s+um|ich\s+kill|du\s+wirst\s+sterben|ich\s+töte|du\s+bist\s+tot)/i, category: "threat", reason: "death threat" },
];

function keywordCheck(text: string): ModerationResult | null {
  const lower = text.toLowerCase();
  for (const { pattern, category, reason } of BLOCK_PATTERNS) {
    if (pattern.test(lower)) {
      return {
        safe: false,
        severity: 3,
        category,
        reason,
        blocked: true,
      };
    }
  }
  return null;
}

// ── Text Moderation ───────────────────────────────────────────────────────────

export async function moderateText(
  text: string,
  contentType: ContentType
): Promise<ModerationResult> {
  if (!text?.trim()) return { safe: true, severity: 0, category: "safe", blocked: false };

  // Fast keyword pre-check
  const kwResult = keywordCheck(text);
  if (kwResult) {
    return {
      ...kwResult,
      message: BLOCKED_MESSAGES[contentType],
    };
  }

  const snippet = text.slice(0, 600);

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a strict content moderation AI for a family-safe German food & restaurant social platform. " +
            "Classify the following user-submitted text (may be in German or English). " +
            "Return ONLY valid JSON with these fields:\n" +
            '- "severity": integer 0-3\n' +
            '- "category": one of ["safe","rude","spam","insult","harassment","explicit","sexual","threat","hate","political"]\n' +
            '- "reason": brief English reason under 10 words\n' +
            "\nSeverity scale:\n" +
            "0 = safe: normal food talk, compliments, casual conversation, mild opinions\n" +
            "1 = borderline: mildly rude tone, mild profanity not targeting anyone, off-topic spam\n" +
            "2 = blocked: clear insults targeting a person, harassment, sexual/explicit language, strong vulgarity, discriminatory slurs\n" +
            "3 = severe: hate speech targeting groups (race, religion, ethnicity, gender), explicit sexual content, violent threats, extremism\n" +
            "\nGerman-specific patterns to detect as severity 2-3:\n" +
            "- Racial/ethnic slurs or 'raus' (get out) targeting groups = severity 3\n" +
            "- Direct personal insults (Idiot, Vollidiot, Scheiß [person], Arschloch) = severity 2\n" +
            "- Hass (hate) combined with ethnic/national/religious groups = severity 3\n" +
            "- Fick/ficken used offensively = severity 2+\n" +
            "- Normal words: Scheiße as exclamation without targeting = severity 1 only",
        },
        { role: "user", content: snippet },
      ],
    });

    const raw = resp.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const severity = (Math.min(Math.max(parseInt(parsed.severity ?? "0", 10), 0), 3)) as ModerationSeverity;
    const category = parsed.category ?? "unknown";

    const blocked = severity >= 2;
    const safe = severity === 0;

    return {
      safe,
      severity,
      category,
      reason: parsed.reason,
      blocked,
      message: blocked
        ? BLOCKED_MESSAGES[contentType]
        : severity === 1
        ? WARNING_MESSAGES[contentType]
        : undefined,
    };
  } catch (err) {
    // On moderation API failure → allow content through (fail-open for text)
    console.error("[moderation] text error:", err);
    return { safe: true, severity: 0, category: "unknown", blocked: false };
  }
}

// ── Image Moderation ──────────────────────────────────────────────────────────

export async function moderateImage(
  imagePath: string,
  contentType: "post_image" | "avatar"
): Promise<ModerationResult> {
  try {
    if (!fs.existsSync(imagePath)) {
      return { safe: true, severity: 0, category: "unknown", blocked: false };
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString("base64");
    const mimeType = imagePath.endsWith(".png")
      ? "image/png"
      : imagePath.endsWith(".gif")
      ? "image/gif"
      : imagePath.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    const systemPrompt =
      contentType === "post_image"
        ? "You are a content moderation AI for a family-safe German food & restaurant social platform. " +
          "Analyze this image. Return ONLY valid JSON with:\n" +
          '- "severity": 0=safe food/restaurant/social/everyday content, 1=borderline or clearly off-topic non-food, 2=inappropriate/offensive/suggestive, 3=explicit nudity/pornography/severe violence/hate imagery\n' +
          '- "category": one of ["safe","off_topic","suggestive","nudity","violence","hate","spam"]\n' +
          '- "food_relevant": true/false (food/restaurant/dining/social eating)\n' +
          '- "reason": brief English reason under 10 words\n' +
          "Rule: any normal food, dining, social, or everyday photo = severity 0. Only escalate for truly inappropriate or sexually suggestive content."
        : "You are a profile photo moderation AI for a family-safe platform. " +
          "Analyze this profile picture. Return ONLY valid JSON with:\n" +
          '- "severity": 0=appropriate person/face/selfie/avatar, 1=borderline, 2=inappropriate/suggestive, 3=explicit nudity/pornography/hate imagery\n' +
          '- "category": one of ["safe","suggestive","nudity","violence","hate","spam"]\n' +
          '- "reason": brief English reason under 10 words\n' +
          "Rule: any normal selfie, portrait, avatar, or person photo = severity 0.";

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
    });

    const raw = resp.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const severity = (Math.min(Math.max(parseInt(parsed.severity ?? "0", 10), 0), 3)) as ModerationSeverity;
    const category = parsed.category ?? "unknown";

    const blocked = severity >= 2;
    const safe = severity <= 1;

    return {
      safe,
      severity,
      category,
      reason: parsed.reason,
      blocked,
      message: blocked
        ? BLOCKED_MESSAGES[contentType]
        : severity === 1
        ? WARNING_MESSAGES[contentType]
        : undefined,
    };
  } catch (err) {
    // On image moderation failure → block by default (fail-safe for images)
    console.error("[moderation] image error:", err);
    return {
      safe: false,
      severity: 2,
      category: "moderation_error",
      blocked: true,
      message: "Dieses Bild konnte nicht überprüft werden. Bitte versuche es erneut.",
    };
  }
}

// ── Strike System ─────────────────────────────────────────────────────────────

export async function getUserStatus(
  userEmail: string,
  pgDb: any
): Promise<UserStatus> {
  try {
    const { rows } = await pgDb.query(
      `SELECT status, strike_count FROM user_strikes WHERE user_email = $1`,
      [userEmail]
    );
    if (rows.length === 0) {
      return { status: "active", strikeCount: 0, suspended: false, restricted: false };
    }
    const { status, strike_count } = rows[0];
    return {
      status,
      strikeCount: strike_count,
      suspended: status === "suspended",
      restricted: status === "restricted" || status === "suspended",
    };
  } catch {
    return { status: "active", strikeCount: 0, suspended: false, restricted: false };
  }
}

export async function recordViolation(
  userEmail: string,
  contentType: ContentType,
  severity: ModerationSeverity,
  reason: string,
  category: string,
  contentPreview: string,
  pgDb: any
): Promise<{ strikeAdded: boolean; newStatus: string; strikeMessage?: string }> {
  try {
    // Log the violation
    await pgDb.query(
      `INSERT INTO moderation_logs (user_email, content_type, severity, category, action, reason, content_preview)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userEmail,
        contentType,
        severity,
        category,
        severity >= 2 ? "blocked" : "warned",
        reason,
        contentPreview.slice(0, 200),
      ]
    );

    // Only increment strikes for severity 2+
    if (severity < 2) {
      return { strikeAdded: false, newStatus: "active" };
    }

    // Upsert user_strikes
    const { rows } = await pgDb.query(
      `INSERT INTO user_strikes (user_email, strike_count, status, last_strike_at, updated_at)
       VALUES ($1, 1, 'warned', now(), now())
       ON CONFLICT (user_email) DO UPDATE
         SET strike_count = user_strikes.strike_count + 1,
             last_strike_at = now(),
             updated_at = now(),
             status = CASE
               WHEN user_strikes.strike_count + 1 >= 3 THEN 'suspended'
               WHEN user_strikes.strike_count + 1 = 2 THEN 'restricted'
               ELSE 'warned'
             END
       RETURNING strike_count, status`,
      [userEmail]
    );

    const { strike_count, status } = rows[0];

    let strikeMessage: string | undefined;
    if (status === "suspended") {
      strikeMessage =
        "Dein Konto wurde wegen wiederholter Verstöße eingeschränkt. Soziale Funktionen sind vorübergehend gesperrt.";
    } else if (status === "restricted") {
      strikeMessage =
        "Weitere Verstöße können zur Sperrung deines Kontos führen.";
    } else {
      strikeMessage = "Bitte beachte unsere Richtlinien.";
    }

    return { strikeAdded: true, newStatus: status, strikeMessage };
  } catch (err) {
    console.error("[moderation] recordViolation error:", err);
    return { strikeAdded: false, newStatus: "active" };
  }
}

// ── Suspension check message ───────────────────────────────────────────────────

export function getSuspendedMessage(contentType: ContentType): string {
  return "Dein Konto ist wegen wiederholter Verstöße eingeschränkt. Du kannst derzeit keine Inhalte veröffentlichen.";
}
