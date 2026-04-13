import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, LANGUAGE_FLAGS } from "@/i18n";

interface LanguagePickerProps {
  variant?: "inline" | "floating";
}

export function LanguagePicker({ variant = "inline" }: LanguagePickerProps) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = i18n.resolvedLanguage ?? i18n.language ?? "de";
  const currentFlag = LANGUAGE_FLAGS[current] ?? "🌐";
  const currentName = LANGUAGE_NAMES[current] ?? "Deutsch";

  function selectLanguage(lang: string) {
    i18n.changeLanguage(lang);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 w-full px-4 py-3 rounded-2xl border border-border/60 bg-card hover:bg-muted/40 transition-colors text-sm cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Globe className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-semibold text-sm leading-none">{t("settings.language")}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <span>{currentFlag}</span>
            <span>{currentName}</span>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden py-1"
          >
            <div className="px-4 py-2.5 border-b border-border/60">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("language_picker.title")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-0.5 p-1.5">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isActive = current.startsWith(lang);
                return (
                  <button
                    key={lang}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => selectLanguage(lang)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors cursor-pointer text-left ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-muted/60 text-foreground"
                    }`}
                  >
                    <span className="text-base leading-none">{LANGUAGE_FLAGS[lang]}</span>
                    <span className="flex-1 truncate">{LANGUAGE_NAMES[lang]}</span>
                    {isActive && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
