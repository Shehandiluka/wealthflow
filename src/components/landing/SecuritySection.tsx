import { Shield, Lock, KeyRound, ShieldCheck, EyeOff, DatabaseZap } from "lucide-react";

interface SecurityPoint {
  icon: typeof Shield;
  titleEn: string;
  bodyEn: string;
  titleSi: string;
  bodySi: string;
}

const POINTS: SecurityPoint[] = [
  {
    icon: DatabaseZap,
    titleEn: "Your data is isolated at the database level",
    bodyEn:
      "Every table is protected by Row-Level Security (RLS) — a rule enforced by the database itself, not just the app's code, that only ever lets your signed-in account read or write your own rows. Another customer's account can never query your accounts, transactions, or any other data, even if there were a bug in the app's interface.",
    titleSi: "ඔයාගේ data එක database level එකේම වෙන් කරලා",
    bodySi:
      "හැම table එකක්ම Row-Level Security (RLS) කියන rule එකකින් protect කරලා — මේක database එකෙන්ම enforce කරන දෙයක්, app එකේ code එකේ විතරක් නෙමෙයි. ඔයාගේ login වුන account එකට විතරයි ඔයාගේම data කියවන්න/වෙනස් කරන්න පුළුවන්. වෙන customer කෙනෙක්ගේ account එකකට ඔයාගේ accounts, transactions, කිසිම දෙයක් query කරන්නවත් බැහැ, app UI එකේ bug එකක් තිබ්බත්.",
  },
  {
    icon: Lock,
    titleEn: "Passwords are never stored or visible",
    bodyEn:
      "Sign-in is handled by Supabase Auth, an industry-standard authentication service. Passwords are one-way hashed before storage — not even we can see your actual password. We only ever see and verify the hash.",
    titleSi: "Password එක කවදාවත් store වෙන්නේවත්, පේන්නේවත් නෑ",
    bodySi:
      "Sign-in එක handle කරන්නේ Supabase Auth කියන industry-standard authentication service එකෙන්. Password එක one-way hash කරලා තමයි store කරන්නේ — ඔයාගේ real password එක අපටවත් බලාගන්න බැහැ. Hash එකේ verification එක විතරයි කරන්නේ.",
  },
  {
    icon: KeyRound,
    titleEn: "The public key in the app isn't a secret",
    bodyEn:
      "The frontend code includes a public \"anon key\" needed to talk to the database — this is by design, visible to anyone, the same way a shop's street address is public. It grants no access on its own; every request made with it still has to pass through the RLS rules above, tied to the signed-in user making the request.",
    titleSi: "App එකේ තියෙන public key එක secret එකක් නෙමෙයි",
    bodySi:
      "Frontend code එකේ \"anon key\" කියලා public key එකක් තියෙනවා, database එකට කතා කරන්න ඕන වෙන එකක් — මේක design එකෙන්ම කාටත් පේන්න තියෙන එකක්, කඩේකට address එකක් public තියෙනවා වගේම. මේකෙන් විතරක්ම කිසිම access එකක් ලැබෙන්නේ නෑ — මේ key එකෙන් යවන request එකකටත් login වුන user කෙනාට අදාළ RLS rules ඔක්කොම pass වෙන්නම ඕන.",
  },
  {
    icon: ShieldCheck,
    titleEn: "API keys for automation are hashed, never stored raw",
    bodyEn:
      "Features like SMS auto-import use a personal access key — that key is hashed before it's saved, exactly like a password. The plaintext key is shown to you once, at creation, and never again — not even to us.",
    titleSi: "Automation වලට පාවිච්චි කරන API keys hash කරලා, raw විදිහට කවදාවත් store කරන්නේ නෑ",
    bodySi:
      "SMS auto-import වගේ features වලට personal access key එකක් පාවිච්චි කරනවා — ඒ key එකත් password එකක් වගේම hash කරලා තමයි save කරන්නේ. Real key එක ඔයාට පේන්නේ එක පාරයි, හදන අවස්ථාවේම — ඊට පස්සේ අපටත් ආයෙත් බලාගන්න බෑ.",
  },
  {
    icon: EyeOff,
    titleEn: "An optional PIN adds a device-level lock",
    bodyEn:
      "A 4-digit PIN can lock the app on a shared or borrowed device — it's a convenience lock on top of your account sign-in, not a replacement for it. It includes brute-force protection (a cooldown after repeated wrong attempts) and auto-locks after 15 minutes of inactivity.",
    titleSi: "Optional PIN එකෙන් device-level lock එකක්",
    bodySi:
      "4-digit PIN එකකින් shared/borrow කරපු device එකක app එක lock කරගන්න පුළුවන් — මේක ඔයාගේ account sign-in එකට අමතරව convenience lock එකක්, ඒක replace කරන එකක් නෙමෙයි. Repeated වැරදි attempts වලින් protect කරන lockout එකකුත්, විනාඩි 15ක් activity නැතුවම auto-lock වෙන එකකුත් තියෙනවා.",
  },
  {
    icon: Shield,
    titleEn: "Encrypted in transit",
    bodyEn:
      "Every connection between your device, this app, and the database runs over HTTPS/TLS — the same encryption standard used by online banking.",
    titleSi: "යවද්දී encrypt වෙනවා",
    bodySi:
      "ඔයාගේ device එකයි, app එකයි, database එකයි අතර connection එකම HTTPS/TLS එකෙන් තමයි යන්නේ — online banking වල පාවිච්චි කරන encryption standard එකම.",
  },
];

export function SecuritySection() {
  return (
    <section aria-labelledby="security-heading" className="mt-4 mb-16">
      <div className="glass-card border-2 border-primary/30 p-6 md:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h2 id="security-heading" className="font-display text-2xl">
            Security &amp; Privacy — how your data is protected
          </h2>
          <p className="text-lg font-semibold text-muted-foreground">
            ආරක්ෂාව සහ පෞද්ගලිකත්වය — ඔයාගේ data ආරක්ෂා වෙන්නේ කොහොමද
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {POINTS.map(({ icon: Icon, titleEn, bodyEn, titleSi, bodySi }) => (
            <div key={titleEn} className="rounded-xl border border-border bg-secondary/30 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{titleEn}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{bodyEn}</p>
                </div>
              </div>
              <div className="border-t border-border pt-3 pl-8 space-y-1">
                <h3 className="font-semibold text-sm">{titleSi}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{bodySi}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground max-w-2xl mx-auto pt-2">
          No security system is absolute — the strongest layer here is that another account can never reach your
          rows at the database level. Keep your password private and treat the optional PIN as a convenience, not a
          substitute for account security.
          <br />
          <span className="italic">
            කිසිම security system එකක් සම්පූර්ණ නෑ — මෙතන තියෙන ශක්තිමත්ම කොටස තමයි වෙන account එකකට ඔයාගේ rows වලට
            database level එකේදීම කවදාවත් ළඟාවෙන්න බැරි වීම. Password එක ඔයාටම හංගාගෙන තියාගන්න, PIN එක convenience
            එකක් විදිහට තියෙනවා මිසක් account security එකට substitute එකක් නෙමෙයි.
          </span>
        </p>
      </div>
    </section>
  );
}
