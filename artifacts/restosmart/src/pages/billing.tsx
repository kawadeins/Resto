import { useState } from "react";
import { useGetSubscription, getGetSubscriptionQueryKey, useStartCheckout, useCancelSubscription } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { CheckCircle2, CreditCard, Lock, Zap, BarChart3, Users, Headphones, Star } from "lucide-react";

const FEATURES = [
  { icon: Zap, text: "Blitzangebote & Rabatte" },
  { icon: BarChart3, text: "Erweiterte Analysen" },
  { icon: Users, text: "Kunden-Marktplatz" },
  { icon: Star, text: "Treueprogramm & Bewertungen" },
  { icon: Headphones, text: "Prioritäts-Support" },
  { icon: Lock, text: "Super-Admin-Zugang" }
];

export default function Billing() {
  const { toast } = useToast();
  const { data: subscription, isLoading } = useGetSubscription({
    query: { queryKey: getGetSubscriptionQueryKey() }
  });

  const startCheckout = useStartCheckout();
  const cancelSubscription = useCancelSubscription();
  const [showSuccess, setShowSuccess] = useState(false);

  const handleCheckout = () => {
    startCheckout.mutate({}, {
      onSuccess: (data) => {
        if (data.success && data.sessionId) {
          // In a real app, we would redirect to Stripe checkout.
          // Here we just simulate success.
          setShowSuccess(true);
          toast({ title: "Abonnement erfolgreich aktiviert" });
        } else {
          toast({ title: "Checkout fehlgeschlagen", variant: "destructive" });
        }
      },
      onError: () => toast({ title: "Checkout konnte nicht gestartet werden", variant: "destructive" })
    });
  };

  const handleCancel = () => {
    cancelSubscription.mutate({}, {
      onSuccess: () => toast({ title: "Abonnement gekündigt" }),
      onError: () => toast({ title: "Kündigung fehlgeschlagen", variant: "destructive" })
    });
  };

  if (isLoading) return <div className="p-8">Laden...</div>;

  const isActive = subscription?.isActive;
  const isTrial = subscription?.status === "trial";

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] pb-10">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-emerald-500/20 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <CardTitle className="text-2xl text-emerald-500">Abonnement aktiv</CardTitle>
              <CardDescription>Willkommen bei RestoSmart Pro</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                Ihre Zahlung war erfolgreich. Alle Premium-Funktionen sind jetzt freigeschaltet.
              </p>
              <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold" onClick={() => window.location.href = "/"}>
                Zum Dashboard
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 max-w-5xl mx-auto">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Abonnement & Abrechnung</h2>
        <p className="text-muted-foreground mt-2">Verwalten Sie Ihren Plan und Ihre Abrechnungsdetails.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className={`h-full ${isActive && !isTrial ? 'border-primary/50' : 'border-border'}`}>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                RestoSmart Pro
                {isActive && !isTrial && <Badge className="bg-emerald-500">Aktiv</Badge>}
              </CardTitle>
              <CardDescription>Alles, was Sie für Ihr Restaurant brauchen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">€30</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              
              <div className="space-y-3">
                {FEATURES.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="bg-primary/10 p-1.5 rounded-full">
                      <feature.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Aktueller Status</CardTitle>
              <CardDescription>Ihre Abrechnungsübersicht</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-6">
              {isTrial && (
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-500 font-medium mb-1">
                    <Zap className="w-4 h-4" />
                    Testphase aktiv
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Sie haben noch {subscription.daysRemaining ?? 0} Tage in Ihrer kostenlosen Testphase.
                  </p>
                </div>
              )}

              {isActive && !isTrial ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Plan</p>
                      <p className="font-semibold">{subscription.planName}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Betrag</p>
                      <p className="font-semibold">€{subscription.amountEur}/Monat</p>
                    </div>
                    {subscription.currentPeriodEnd && (
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">Nächstes Abrechnungsdatum</p>
                        <p className="font-semibold">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <div className="bg-muted p-4 rounded-full">
                    <CreditCard className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">RestoSmart Pro aktivieren</h3>
                    <p className="text-sm text-muted-foreground">Jetzt upgraden und alle Premium-Funktionen freischalten.</p>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t pt-6">
              {isActive && !isTrial ? (
                <Button variant="destructive" className="w-full" onClick={handleCancel} disabled={cancelSubscription.isPending}>
                  Abonnement kündigen
                </Button>
              ) : (
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold" 
                  size="lg"
                  onClick={handleCheckout}
                  disabled={startCheckout.isPending}
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  {startCheckout.isPending ? "Verarbeite..." : "Auf Pro upgraden — €30/Monat"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}