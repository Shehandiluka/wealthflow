import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SecuritySection } from "@/components/landing/SecuritySection";
import {
  Wallet,
  ArrowLeftRight,
  PieChart,
  TrendingUp,
  CreditCard,
  Plane,
  HandCoins,
  MessageSquareText,
} from "lucide-react";

const pillars = [
  {
    icon: Wallet,
    title: "Every wallet, its own currency",
    body: "Cash, bank, and card accounts in LKR, ILS, USD, or whatever you actually hold — nothing gets silently converted or blended.",
  },
  {
    icon: PieChart,
    title: "Budgets that know the difference",
    body: "A limit set in rupees only ever measures itself against rupees spent — not shekels or dollars mixed in by accident.",
  },
  {
    icon: TrendingUp,
    title: "The full picture, on request",
    body: "See everything converted to one number when you want it, and every currency on its own terms when you don't.",
  },
];

const moreFeatures = [
  { icon: ArrowLeftRight, title: "Transfers with real fees", body: "Move money between wallets across currencies, apply the exchange rate, and log the bank's charge as its own expense." },
  { icon: MessageSquareText, title: "SMS and quick-note drafts", body: "Forward a bank SMS or jot \"500 LKR milk.\" It waits as a draft until you confirm it." },
  { icon: CreditCard, title: "Debts, EMIs, and interest", body: "Principal and interest are tracked separately — an interest payment never quietly shrinks what you still owe." },
  { icon: Plane, title: "Trip budgets", body: "Plan a trip in its own currency, log spending day by day, compare planned against actual." },
  { icon: HandCoins, title: "Lending, with repayments in a different currency", body: "Lend in one currency, get repaid in another — the balance still resolves correctly." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)]">
        <span className="font-display text-xl">WealthFlow</span>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        <section className="py-10 md:py-20 grid md:grid-cols-2 gap-10 md:gap-8 items-center">
          <div className="space-y-6">
            <h1 className="font-display text-4xl md:text-5xl leading-[1.1]">
              Money doesn't stay in one currency. Your ledger shouldn't either.
            </h1>
            <p className="max-w-md text-base text-muted-foreground">
              Track every wallet, loan, and goal in whichever currency it actually
              lives in — rupees, shekels, dollars — converted to one number only
              when you ask for it, never blended by accident.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Button asChild size="lg">
                <Link to="/auth">Start your ledger</Link>
              </Button>
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Already have an account? Sign in
              </Link>
            </div>
          </div>

          <div className="glass-card p-5 font-mono text-sm md:ml-auto md:max-w-sm w-full">
            <div className="flex items-baseline justify-between pb-3 mb-3 border-b border-border">
              <span className="text-muted-foreground text-xs font-sans">Net worth · LKR</span>
              <span className="font-display text-2xl">₨1,284,600</span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Salary · Frimi</span>
                <span>+ ₨185,000</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Groceries · Shekel Hand</span>
                <span className="text-destructive">− ₪86.40</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Loan interest · Home Loan</span>
                <span className="text-destructive">− ₨4,200</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Transfer fee · Monox → Frimi</span>
                <span className="text-destructive">− $2.50</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Freelance invoice</span>
                <span className="text-success">+ $340.00</span>
              </div>
            </div>
          </div>
        </section>

        <SecuritySection />

        <section aria-labelledby="pillars-heading" className="space-y-8 mt-4">
          <div className="max-w-2xl">
            <h2 id="pillars-heading" className="font-display text-2xl">
              Built for a life that crosses currencies
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {pillars.map(({ icon: Icon, title, body }) => (
              <div key={title} className="space-y-2.5">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          <div className="glass-card divide-y divide-border">
            {moreFeatures.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 p-5">
                <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-sm">{title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="how-heading" className="mt-16 space-y-8">
          <h2 id="how-heading" className="font-display text-2xl">
            Three steps, then it runs itself
          </h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              { n: "1", title: "Add your wallets", body: "Create an account for each currency you actually hold, and set the currency your net worth reports in." },
              { n: "2", title: "Capture spending fast", body: "The quick-add bar, a scanned receipt, or a forwarded bank SMS — each becomes a draft you confirm in one tap." },
              { n: "3", title: "Review and plan", body: "Budgets, upcoming payments, debt balances, and investment returns, all from one dashboard." },
            ].map((step) => (
              <li key={step.n}>
                <span className="font-display text-4xl text-primary/70">{step.n}</span>
                <h3 className="font-semibold mt-2">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 glass-card p-8 md:p-10 text-center space-y-4">
          <h2 className="font-display text-2xl">Your first entry takes under a minute</h2>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            Your data stays tied to your own account, protected by sign-in and an optional
            PIN lock on this device.
          </p>
          <Button asChild size="lg">
            <Link to="/auth">Start your ledger</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        WealthFlow
      </footer>
    </div>
  );
}
