import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { QuickNoteFab } from "@/components/dashboard/QuickNoteFab";
import { OnboardingGuide } from "@/components/OnboardingGuide";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: hasSeenOnboarding } = useQuery({
    queryKey: ["has-seen-onboarding", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("has_seen_onboarding")
        .eq("user_id", user!.id)
        .single();
      return data?.has_seen_onboarding ?? true; // fail-safe: don't show if we can't confirm the flag
    },
    enabled: !!user,
  });

  const dismissOnboarding = async () => {
    if (!user) return;
    // Optimistically hide it immediately, then persist
    qc.setQueryData(["has-seen-onboarding", user.id], true);
    await supabase.from("profiles").update({ has_seen_onboarding: true }).eq("user_id", user.id);
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto pb-20 md:pb-0 pt-[env(safe-area-inset-top,0px)]">
        {children}
      </main>
      <MobileBottomNav />
      <QuickNoteFab />
      {hasSeenOnboarding === false && <OnboardingGuide onComplete={dismissOnboarding} />}
    </div>
  );
}
