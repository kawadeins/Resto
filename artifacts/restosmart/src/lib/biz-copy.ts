import i18n from "@/i18n";

export type BizType = "restaurant" | "cafe" | "bar";

export function getBizType(): BizType {
  const raw = localStorage.getItem("restosmart_owner_business_type") ?? "restaurant";
  if (raw === "cafe" || raw === "bar") return raw;
  return "restaurant";
}

const g = (key: string, type: BizType): string => i18n.t(`biz.${key}_${type}`);

function makeLookup(key: string): Record<BizType, string> {
  return {
    get restaurant(): string { return g(key, "restaurant"); },
    get cafe(): string { return g(key, "cafe"); },
    get bar(): string { return g(key, "bar"); },
  } as Record<BizType, string>;
}

export const BIZ_LABEL                 = makeLookup("label");
export const BIZ_POSSESSIVE            = makeLookup("possessive");
export const BIZ_DATIVE                = makeLookup("dative");
export const BIZ_MENU_LABEL            = makeLookup("menu_label");
export const BIZ_MENU_EDITOR_LABEL     = makeLookup("menu_editor_label");
export const BIZ_TABLE_MODULE_LABEL    = makeLookup("table_module_label");
export const BIZ_RESERVATION_LABEL     = makeLookup("reservation_label");
export const BIZ_NAME_LABEL            = makeLookup("name_label");
export const BIZ_CUISINE_LABEL         = makeLookup("cuisine_label");
export const BIZ_DESCRIPTION_PLACEHOLDER = makeLookup("description_placeholder");
export const BIZ_STEP1_LABEL           = makeLookup("possessive");
export const BIZ_STEP2_LABEL           = makeLookup("step2");
export const BIZ_ONBOARDING_TITLE      = makeLookup("onboarding_title");
export const BIZ_MENU_ONBOARDING_TITLE = makeLookup("menu_onboarding_title");
export const BIZ_MENU_ONBOARDING_SUBTITLE = makeLookup("menu_onboarding_subtitle");
export const BIZ_MENU_EMPTY_STATE      = makeLookup("menu_empty_state");
export const BIZ_MENU_ADD_HINT         = makeLookup("menu_add_hint");
export const BIZ_MENU_PAGE_LINK_LABEL  = makeLookup("menu_page_link");
export const BIZ_MARKETPLACE_ACTIVATE_DESC = makeLookup("marketplace_activate_desc");
export const BIZ_MARKETPLACE_ACTIVE_DESC   = makeLookup("marketplace_active_desc");
export const BIZ_LIVE_TOAST            = makeLookup("live_toast");
export const BIZ_SETUP_TITLE           = makeLookup("setup_title");

export const BIZ_SETUP_SUBTITLE: Record<BizType, string> = {
  restaurant: "Get your restaurant live in under 5 minutes.",
  cafe: "Get your café live in under 5 minutes.",
  bar: "Get your bar live in under 5 minutes.",
};

export const BIZ_EMAIL_PLACEHOLDER: Record<BizType, string> = {
  restaurant: "info@ihrrestaurant.at",
  cafe: "info@ihrcafe.at",
  bar: "info@ihrebar.at",
};
