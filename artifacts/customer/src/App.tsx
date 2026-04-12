import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";

import Home from "@/pages/home";
import Explore from "@/pages/explore";
import Restaurant from "@/pages/restaurant";
import MyBookings from "@/pages/my-bookings";
import Profile from "@/pages/profile";
import Settings from "@/pages/settings";
import MealPlan from "@/pages/meal-plan";
import Friends from "@/pages/friends";
import ForBusiness from "@/pages/for-business";
import PlanDetail from "@/pages/plan-detail";
import { AppRatingPrompt } from "@/components/app-rating-prompt";
import { SmartReminders } from "@/components/smart-reminders";
import { SocialProvider } from "@/contexts/social-context";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/explore" component={Explore} />
      <Route path="/restaurant/:id" component={Restaurant} />
      <Route path="/my-bookings" component={MyBookings} />
      <Route path="/meal-plan" component={MealPlan} />
      <Route path="/friends" component={Friends} />
      <Route path="/profile" component={Profile} />
      <Route path="/settings" component={Settings} />
      <Route path="/for-business" component={ForBusiness} />
      <Route path="/plan/:id" component={PlanDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function GlobalLayers() {
  const [email, setEmail] = useState("");
  useEffect(() => {
    const sync = () => setEmail(localStorage.getItem("restosmart_email") ?? "");
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return (
    <>
      <SmartReminders email={email} />
      <AppRatingPrompt email={email} />
    </>
  );
}

function AppShell() {
  const [email, setEmail] = useState("");
  useEffect(() => {
    const sync = () => setEmail(localStorage.getItem("restosmart_email") ?? "");
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return (
    <SocialProvider email={email}>
      <Layout>
        <Router />
      </Layout>
      <GlobalLayers />
    </SocialProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppShell />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
