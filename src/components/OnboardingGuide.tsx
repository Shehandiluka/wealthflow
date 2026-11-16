import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Receipt, Percent, PiggyBank, BarChart3, ShieldCheck,
  ChevronRight, ChevronLeft, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Step {
  icon: typeof Wallet;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: Wallet,
    title: "Welcome to WealthFlow",
    body: "Track every wallet, loan, investment, and goal in one place — across as many currencies as you use, LKR, USD, ILS, whatever fits your life.",
  },
  {
    icon: Wallet,
    title: "Multi-Currency Accounts",
    body: "Add a wallet for each account you actually use — cash, bank, savings — each with its own currency. Nothing gets silently converted or mixed together.",
  },
  {
    icon: Receipt,
    title: "Fast Transactions",
    body: "Log expenses and income from the quick-add bar on the dashboard, or the Transactions page for full detail. Link any expense to a debt, trip, or investment as you go.",
  },
  {
    icon: Percent,
    title: "Debts — Principal vs Interest",
    body: "When you pay a loan, record principal and interest separately. Interest is a real cost, but only principal payments reduce what you still owe — the app keeps that straight for you.",
  },
  {
    icon: PiggyBank,
    title: "Savings Goals",
    body: "Set a target — a tax bill, a vehicle, an emergency fund — with a deadline. WealthFlow works out how much to save each month, and tells you if you're on track.",
  },
  {
    icon: BarChart3,
    title: "Analytics, Currency by Currency",
    body: "See spending broken down by main category and sub-category, separately for each currency you use — never blended into one misleading number.",
  },
  {
    icon: ShieldCheck,
    title: "Security & Backup",
    body: "A PIN locks the app on this device. Turn on due-date reminders in Settings for loans coming up, and check Settings → Data Health Check any time to see exactly what's saved.",
  },
];

interface OnboardingGuideProps {
  onComplete: () => void;
}

export function OnboardingGuide({ onComplete }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md p-6 relative"
      >
        <button
          onClick={onComplete}
          aria-label="Skip walkthrough"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="text-center space-y-4 py-4"
          >
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-bold">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed px-2">{current.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-center gap-1.5 my-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-5 bg-primary" : "w-1.5 bg-secondary"
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="outline" size="icon" onClick={() => setStep((s) => s - 1)} aria-label="Back">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <Button
            className="flex-1 gap-1.5"
            onClick={() => (isLast ? onComplete() : setStep((s) => s + 1))}
          >
            {isLast ? "Get Started" : "Next"}
            {!isLast && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        {!isLast && (
          <button
            onClick={onComplete}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-3"
          >
            Skip walkthrough
          </button>
        )}
      </motion.div>
    </div>
  );
}
