/**
 * PrivacyToggle — lets users choose their activity visibility.
 * Stores preference in localStorage and updates the API.
 */
import { useState } from "react";
import { Globe, Users, Lock, ChevronDown } from "lucide-react";
import { getSocialPrivacy, setSocialPrivacy, type Visibility } from "@/lib/social-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS: { value: Visibility; label: string; desc: string; icon: typeof Globe; cls: string }[] = [
  {
    value: "public",
    label: "Öffentlich",
    desc: "Alle können deine Aktivität sehen",
    icon: Globe,
    cls: "text-emerald-600",
  },
  {
    value: "friends",
    label: "Nur Freunde",
    desc: "Nur deine Freunde sehen deine Aktivität",
    icon: Users,
    cls: "text-primary",
  },
  {
    value: "private",
    label: "Privat",
    desc: "Niemand sieht deine Aktivität",
    icon: Lock,
    cls: "text-muted-foreground",
  },
];

interface PrivacyToggleProps {
  onChangeCallback?: (v: Visibility) => void;
  className?: string;
}

export function PrivacyToggle({ onChangeCallback, className }: PrivacyToggleProps) {
  const [value, setValue] = useState<Visibility>(getSocialPrivacy);

  const current = OPTIONS.find(o => o.value === value) ?? OPTIONS[1];
  const CurrentIcon = current.icon;

  const handleChange = (v: Visibility) => {
    setSocialPrivacy(v);
    setValue(v);
    onChangeCallback?.(v);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl border border-border/60 bg-background hover:bg-muted/50 transition-colors text-sm font-semibold ${className ?? ""}`}
        >
          <CurrentIcon className={`w-4 h-4 ${current.cls}`} />
          <span>{current.label}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
        {OPTIONS.map(opt => {
          const Icon = opt.icon;
          const isActive = opt.value === value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer ${isActive ? "bg-primary/8" : ""}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${opt.cls}`} />
              <div>
                <p className={`text-sm font-bold ${isActive ? "text-primary" : ""}`}>{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
              {isActive && (
                <div className="ml-auto w-2 h-2 rounded-full bg-primary mt-1.5" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * PrivacyBanner — compact inline notice (for profile / friends panel)
 */
export function PrivacyBanner({ className }: { className?: string }) {
  const [privacy, setPrivacy] = useState<Visibility>(getSocialPrivacy);

  const cfg = {
    public:  { icon: "🌍", text: "Öffentlich sichtbar", cls: "bg-emerald-50 border-emerald-200 text-emerald-800" },
    friends: { icon: "👥", text: "Nur Freunde sehen dich", cls: "bg-primary/8 border-primary/20 text-primary" },
    private: { icon: "🔒", text: "Privat – niemand sieht dich", cls: "bg-muted border-border/40 text-muted-foreground" },
  };

  const c = cfg[privacy];

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${c.cls} ${className ?? ""}`}>
      <span className="text-base leading-none">{c.icon}</span>
      <span className="text-xs font-bold flex-1">{c.text}</span>
      <PrivacyToggle onChangeCallback={setPrivacy} />
    </div>
  );
}
