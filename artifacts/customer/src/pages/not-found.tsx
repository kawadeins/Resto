import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/20 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertCircle className="h-10 w-10 text-destructive" />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">404</h1>
          <p className="text-lg font-semibold text-foreground mb-1">{t("error.not_found")}</p>
          <p className="text-sm text-muted-foreground">{t("error.not_found_hint")}</p>
        </div>
        <Button asChild className="rounded-full">
          <Link href="/">
            <Home className="w-4 h-4 mr-2" />
            {t("error.go_home")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
