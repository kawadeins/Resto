export type BizType = "restaurant" | "cafe" | "bar";

export function getBizType(): BizType {
  const raw = localStorage.getItem("restosmart_owner_business_type") ?? "restaurant";
  if (raw === "cafe" || raw === "bar") return raw;
  return "restaurant";
}

export const BIZ_LABEL: Record<BizType, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
};

export const BIZ_POSSESSIVE: Record<BizType, string> = {
  restaurant: "Ihr Restaurant",
  cafe: "Ihr Café",
  bar: "Ihre Bar",
};

export const BIZ_DATIVE: Record<BizType, string> = {
  restaurant: "dem Restaurant",
  cafe: "dem Café",
  bar: "der Bar",
};

export const BIZ_MENU_LABEL: Record<BizType, string> = {
  restaurant: "Speisekarte",
  cafe: "Getränke & Speisekarte",
  bar: "Getränkekarte",
};

export const BIZ_MENU_EDITOR_LABEL: Record<BizType, string> = {
  restaurant: "Speisekarten-Editor",
  cafe: "Speisekarten-Editor",
  bar: "Getränkekarten-Editor",
};

export const BIZ_TABLE_MODULE_LABEL: Record<BizType, string> = {
  restaurant: "Tischplan & Verfügbarkeit",
  cafe: "Plätze & Verfügbarkeit",
  bar: "Sitzplatz & Verfügbarkeit",
};

export const BIZ_RESERVATION_LABEL: Record<BizType, string> = {
  restaurant: "Reservierungsverwaltung",
  cafe: "Reservierungen",
  bar: "Reservierungen",
};

export const BIZ_NAME_LABEL: Record<BizType, string> = {
  restaurant: "Restaurantname",
  cafe: "Café-Name",
  bar: "Bar-Name",
};

export const BIZ_CUISINE_LABEL: Record<BizType, string> = {
  restaurant: "Küchenstil",
  cafe: "Spezialität / Stil",
  bar: "Konzept / Stil",
};

export const BIZ_DESCRIPTION_PLACEHOLDER: Record<BizType, string> = {
  restaurant: "Was macht Ihr Restaurant besonders? (optional)",
  cafe: "Was macht Ihr Café besonders? (optional)",
  bar: "Was macht Ihre Bar besonders? (optional)",
};

export const BIZ_EMAIL_PLACEHOLDER: Record<BizType, string> = {
  restaurant: "info@ihrrestaurant.at",
  cafe: "info@ihrcafe.at",
  bar: "info@ihrebar.at",
};

export const BIZ_STEP1_LABEL: Record<BizType, string> = {
  restaurant: "Ihr Restaurant",
  cafe: "Ihr Café",
  bar: "Ihre Bar",
};

export const BIZ_STEP2_LABEL: Record<BizType, string> = {
  restaurant: "Speisekarte",
  cafe: "Angebot",
  bar: "Getränkekarte",
};

export const BIZ_ONBOARDING_TITLE: Record<BizType, string> = {
  restaurant: "Erzählen Sie uns von Ihrem Restaurant",
  cafe: "Erzählen Sie uns von Ihrem Café",
  bar: "Erzählen Sie uns von Ihrer Bar",
};

export const BIZ_MENU_ONBOARDING_TITLE: Record<BizType, string> = {
  restaurant: "Speisekarte hinzufügen",
  cafe: "Angebot hinzufügen",
  bar: "Getränkekarte hinzufügen",
};

export const BIZ_MENU_ONBOARDING_SUBTITLE: Record<BizType, string> = {
  restaurant: "Mindestens ein aktives Menüelement ist erforderlich, bevor Kunden Ihr Restaurant sehen können.",
  cafe: "Mindestens ein aktives Angebot ist erforderlich, bevor Kunden Ihr Café sehen können.",
  bar: "Mindestens ein aktiver Eintrag ist erforderlich, bevor Kunden Ihre Bar sehen können.",
};

export const BIZ_MENU_EMPTY_STATE: Record<BizType, string> = {
  restaurant: "Noch keine Speisekarte",
  cafe: "Noch kein Angebot",
  bar: "Noch keine Getränkekarte",
};

export const BIZ_MENU_ADD_HINT: Record<BizType, string> = {
  restaurant: "Gehen Sie zur Speisekartenseite und fügen Sie Ihr erstes Gericht hinzu.",
  cafe: "Gehen Sie zur Speisekartenseite und fügen Sie Ihr erstes Angebot hinzu.",
  bar: "Gehen Sie zur Getränkekartenseite und fügen Sie Ihren ersten Eintrag hinzu.",
};

export const BIZ_MENU_PAGE_LINK_LABEL: Record<BizType, string> = {
  restaurant: "Zur Speisekarte",
  cafe: "Zum Angebot",
  bar: "Zur Getränkekarte",
};

export const BIZ_MARKETPLACE_ACTIVATE_DESC: Record<BizType, string> = {
  restaurant: "Nach der Aktivierung können Kunden Ihr Restaurant über den Marktplatz finden und buchen.",
  cafe: "Nach der Aktivierung können Kunden Ihr Café über den Marktplatz finden und besuchen.",
  bar: "Nach der Aktivierung können Kunden Ihre Bar über den Marktplatz entdecken.",
};

export const BIZ_MARKETPLACE_ACTIVE_DESC: Record<BizType, string> = {
  restaurant: "Kunden können Ihr Restaurant jetzt im Marktplatz entdecken und buchen.",
  cafe: "Kunden können Ihr Café jetzt im Marktplatz entdecken.",
  bar: "Kunden können Ihre Bar jetzt im Marktplatz entdecken.",
};

export const BIZ_LIVE_TOAST: Record<BizType, string> = {
  restaurant: "Ihr Restaurant ist jetzt im Marktplatz sichtbar.",
  cafe: "Ihr Café ist jetzt im Marktplatz sichtbar.",
  bar: "Ihre Bar ist jetzt im Marktplatz sichtbar.",
};

export const BIZ_SETUP_TITLE: Record<BizType, string> = {
  restaurant: "Restaurant Setup",
  cafe: "Café Setup",
  bar: "Bar Setup",
};

export const BIZ_SETUP_SUBTITLE: Record<BizType, string> = {
  restaurant: "Get your restaurant live in under 5 minutes.",
  cafe: "Get your café live in under 5 minutes.",
  bar: "Get your bar live in under 5 minutes.",
};
