import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, LANGUAGE_FLAGS } from "@/i18n";

interface LanguagePickerProps {
  compact?: boolean;
}

export function LanguagePicker({ compact = false }: LanguagePickerProps) {
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
        className={
          compact
            ? "flex items-center gap-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/40 cursor-pointer"
            : "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-border/50 bg-background hover:bg-muted/50 transition-colors text-sm"
        }
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className={compact ? "w-3.5 h-3.5" : "w-4 h-4 text-muted-foreground shrink-0"} />
        <span className={compact ? "" : "flex-1 text-left"}>
          {compact ? currentFlag : (
            <span className="flex items-center gap-2">
              <span>{currentFlag}</span>
              <span>{currentName}</span>
            </span>
          )}
        </span>
        <ChevronDown
          className={`${compact ? "w-3 h-3" : "w-4 h-4 text-muted-foreground"} transition-transform ${open ? "rotate-180" : ""}`}
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
            className={`absolute z-50 mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden py-1 min-w-[180px] ${compact ? "bottom-full mb-2 right-0" : "left-0 top-full"}`}
          >
            <div className="px-3 py-2 border-b border-border/60">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("language_picker.title")}
              </p>
            </div>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = current.startsWith(lang);
              return (
                <button
                  key={lang}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => selectLanguage(lang)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors cursor-pointer text-left"
                >
                  <span className="text-base leading-none">{LANGUAGE_FLAGS[lang]}</span>
                  <span className={`flex-1 ${isActive ? "font-semibold text-primary" : "text-foreground"}`}>
                    {LANGUAGE_NAMES[lang]}
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
