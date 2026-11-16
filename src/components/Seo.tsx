import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://wealthflow.example.com";
const BRAND = "WealthFlow — Smart Money Manager";

interface RouteMeta {
  title: string;
  description: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "WealthFlow — Multi-Currency Personal Finance Manager",
    description:
      "Track multi-currency accounts, spending, budgets, debts and EMIs, investments, trip budgets and loans between friends in one private dashboard.",
  },
  "/auth": {
    title: `Sign In | ${BRAND}`,
    description: "Sign in or create your WealthFlow account to track accounts, budgets, debts and investments.",
  },
  "/accounts": {
    title: `Accounts | ${BRAND}`,
    description: "Manage cash, bank and credit card accounts across currencies with live balances.",
  },
  "/transactions": {
    title: `Transactions | ${BRAND}`,
    description: "Log, edit and review every income, expense and transfer with drafts and quick add.",
  },
  "/analytics": {
    title: `Analytics | ${BRAND}`,
    description: "Spending and income breakdowns by category and currency, with trends over time.",
  },
  "/investments": {
    title: `Investments | ${BRAND}`,
    description: "Track stocks, gold, fixed deposits and custom investment types with returns and contributions.",
  },
  "/debts": {
    title: `Debts & EMIs | ${BRAND}`,
    description: "Track loans and EMIs, record payments and watch remaining balances fall.",
  },
  "/budgets": {
    title: `Budgets | ${BRAND}`,
    description: "Set monthly category budgets and follow progress with alerts before you overspend.",
  },
  "/recurring": {
    title: `Recurring | ${BRAND}`,
    description: "Automate salaries, subscriptions and EMIs with scheduled recurring transactions.",
  },
  "/trips": {
    title: `Trip Planner | ${BRAND}`,
    description: "Plan trip budgets, log travel expenses by day and compare planned versus actual spend.",
  },
  "/pay-later": {
    title: `Pay Later | ${BRAND}`,
    description: "Track store tabs and informal credit, add items and record partial payments.",
  },
  "/lending": {
    title: `Lend & Borrow | ${BRAND}`,
    description: "Track money lent to or borrowed from people, including cross-currency repayments.",
  },
  "/categories": {
    title: `Categories | ${BRAND}`,
    description: "Organise income and expense categories with parent categories and subcategories.",
  },
  "/sms-imports": {
    title: `Draft Inbox | ${BRAND}`,
    description: "Review bank SMS and quick-note drafts, then post them as transactions in one tap.",
  },
  "/settings": {
    title: `Settings | ${BRAND}`,
    description: "Base currency, PIN lock, exchange rates, reminders, backups and account settings.",
  },
};

const FALLBACK: RouteMeta = {
  title: BRAND,
  description:
    "Multi-currency wealth management: accounts, investments, debts, budgets and spending in one place.",
};

export function Seo() {
  const { pathname } = useLocation();
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
  const meta = ROUTE_META[path] ?? FALLBACK;
  const url = `${SITE_URL}${path === "/" ? "/" : path}`;

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
    </Helmet>
  );
}
