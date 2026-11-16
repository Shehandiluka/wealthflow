import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Delete, Fingerprint, LogOut, KeyRound, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PinLockScreenProps {
  onUnlock: () => void;
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ---- Brute-force protection ----
 * 4-digit PINs only have 10,000 combinations, so without a limit someone with a few
 * minutes of unsupervised access to an unlocked browser tab could script through all
 * of them. Track failed attempts per user in sessionStorage (survives refresh, clears
 * on tab close) and lock out with an increasing cooldown after every 5 misses.
 */
interface PinAttemptState {
  count: number;
  lockedUntil: number | null;
  lockoutLevel: number;
}
const attemptsKey = (userId: string) => `wealthflow_pin_attempts_${userId}`;
const MAX_ATTEMPTS = 5;
const lockoutSeconds = (level: number) => Math.min(30 * 2 ** (level - 1), 300); // 30s, 60s, 120s... capped at 5min

function readAttempts(userId: string): PinAttemptState {
  try {
    const raw = sessionStorage.getItem(attemptsKey(userId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore malformed state */ }
  return { count: 0, lockedUntil: null, lockoutLevel: 0 };
}
function writeAttempts(userId: string, state: PinAttemptState) {
  sessionStorage.setItem(attemptsKey(userId), JSON.stringify(state));
}
function clearAttempts(userId: string) {
  sessionStorage.removeItem(attemptsKey(userId));
}

function PinKeypad({
  pin,
  maxLength,
  title,
  subtitle,
  error,
  onDigit,
  onDelete,
  footer,
}: {
  pin: string;
  maxLength: number;
  title: string;
  subtitle: string;
  error: boolean;
  onDigit: (d: string) => void;
  onDelete: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-xs space-y-8 text-center"
    >
      <div className="space-y-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl">WealthFlow</h1>
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex justify-center gap-4">
        {Array.from({ length: maxLength }).map((_, i) => (
          <motion.div
            key={i}
            animate={error ? { x: [0, -8, 8, -8, 8, 0] } : {}}
            transition={{ duration: 0.4 }}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < pin.length ? "bg-primary border-primary scale-110" : "border-muted-foreground/40"
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
          if (key === "") return <div key="empty" />;
          if (key === "del") {
            return (
              <button
                key="del"
                onClick={onDelete}
                className="h-16 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-secondary/60 active:bg-secondary transition-colors"
              >
                <Delete className="h-5 w-5" />
              </button>
            );
          }
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.9 }}
              onClick={() => onDigit(key)}
              className="h-16 rounded-xl bg-secondary/40 hover:bg-secondary/70 active:bg-primary/20 transition-colors text-xl font-semibold text-foreground"
            >
              {key}
            </motion.button>
          );
        })}
      </div>

      {footer}
    </motion.div>
  );
}

function ForgotPinForm({ onReset, onBack }: { onReset: () => void; onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !password.trim()) return;
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (error) {
      setLoading(false);
      toast({ title: "Incorrect password", description: "Please try again.", variant: "destructive" });
      return;
    }

    // Password verified — clear PIN so user enters setup flow
    await supabase.from("profiles").update({ pin_hash: null }).eq("user_id", user.id);
    setLoading(false);
    toast({ title: "Identity verified", description: "Set your new PIN." });
    onReset();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-xs space-y-6 text-center"
    >
      <div className="space-y-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <KeyRound className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl">WealthFlow</h1>
        <p className="text-lg font-semibold">Reset PIN</p>
        <p className="text-sm text-muted-foreground">
          Enter your account password to verify your identity
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-4 text-left">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email || ""} disabled className="bg-secondary/50 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="forgot-pw">Password</Label>
          <Input
            id="forgot-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-secondary border-border"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Verify & Reset PIN
        </Button>
      </form>

      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mx-auto"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to PIN entry
      </button>
    </motion.div>
  );
}

export function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState("");
  const [isSetup, setIsSetup] = useState(false);
  const [confirmPin, setConfirmPin] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [loading, setLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [error, setError] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!user) return;
    const attempts = readAttempts(user.id);
    if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
      setLockedUntil(attempts.lockedUntil);
    }
    supabase
      .from("profiles")
      .select("pin_hash")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setHasPin(!!data?.pin_hash);
        setIsSetup(!data?.pin_hash);
        setLoading(false);
      });
  }, [user]);

  // Countdown tick while locked out
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) setLockedUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const handleDigit = useCallback((digit: string) => {
    if (lockedUntil) return;
    setError(false);
    if (step === "confirm") {
      if (confirmPin.length < 4) setConfirmPin(prev => prev + digit);
    } else {
      if (pin.length < 4) setPin(prev => prev + digit);
    }
  }, [pin, confirmPin, step, lockedUntil]);

  const handleDelete = useCallback(() => {
    if (step === "confirm") {
      setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  }, [step]);

  // Laptop/desktop: let the physical keyboard type the PIN too, not just the
  // on-screen keypad — both the number row and the numeric keypad.
  useEffect(() => {
    if (loading || showForgot || (lockedUntil && secondsLeft > 0)) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDigit, handleDelete, loading, lockedUntil, secondsLeft]);

  useEffect(() => {
    if (isSetup && step === "enter" && pin.length === 4) setStep("confirm");
  }, [pin, isSetup, step]);

  useEffect(() => {
    if (isSetup && step === "confirm" && confirmPin.length === 4) {
      if (confirmPin === pin) {
        handleSetPin(pin);
      } else {
        setError(true);
        setConfirmPin("");
        toast({ title: "PINs don't match", description: "Try again", variant: "destructive" });
      }
    }
  }, [confirmPin, pin, isSetup, step]);

  useEffect(() => {
    if (!isSetup && pin.length === 4) handleVerify(pin);
  }, [pin, isSetup]);

  const handleSetPin = async (newPin: string) => {
    if (!user) return;
    setLoading(true);
    const hashed = await hashPin(newPin);
    const { error } = await supabase.from("profiles").update({ pin_hash: hashed }).eq("user_id", user.id);
    setLoading(false);
    if (error) { toast({ title: "Error saving PIN", variant: "destructive" }); return; }
    toast({ title: "PIN set successfully!" });
    onUnlock();
  };

  const handleVerify = async (entered: string) => {
    if (!user) return;
    const hashed = await hashPin(entered);
    const { data } = await supabase.from("profiles").select("pin_hash").eq("user_id", user.id).single();
    if (data?.pin_hash === hashed) {
      clearAttempts(user.id);
      onUnlock();
    } else {
      setError(true);
      setPin("");
      const prev = readAttempts(user.id);
      const count = prev.count + 1;
      if (count >= MAX_ATTEMPTS) {
        const lockoutLevel = prev.lockoutLevel + 1;
        const until = Date.now() + lockoutSeconds(lockoutLevel) * 1000;
        writeAttempts(user.id, { count: 0, lockedUntil: until, lockoutLevel });
        setLockedUntil(until);
        toast({ title: "Too many wrong attempts", description: `Locked for ${lockoutSeconds(lockoutLevel)}s.`, variant: "destructive" });
      } else {
        writeAttempts(user.id, { ...prev, count });
        toast({ title: "Wrong PIN", description: `Try again (${MAX_ATTEMPTS - count} attempt${MAX_ATTEMPTS - count === 1 ? "" : "s"} left)`, variant: "destructive" });
      }
    }
  };

  const handleForgotReset = () => {
    // PIN cleared in DB, switch to setup mode
    if (user) clearAttempts(user.id);
    setLockedUntil(null);
    setShowForgot(false);
    setIsSetup(true);
    setStep("enter");
    setPin("");
    setConfirmPin("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Lock className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (lockedUntil && secondsLeft > 0 && !showForgot) {
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-xs space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold">Too many wrong attempts</p>
            <p className="text-sm text-muted-foreground">Try again in</p>
            <p className="text-3xl font-mono font-bold text-destructive tabular-nums">
              {mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`}
            </p>
          </div>
          <div className="space-y-3">
            <button onClick={() => setShowForgot(true)} className="text-xs text-primary hover:underline font-medium">
              Forgot PIN? Verify with password instead
            </button>
            <button onClick={() => signOut()} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1.5 mx-auto">
              <LogOut className="h-3.5 w-3.5" /> Sign out &amp; switch account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (showForgot && lockedUntil && secondsLeft > 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <ForgotPinForm onReset={handleForgotReset} onBack={() => setShowForgot(false)} />
      </div>
    );
  }

  const currentPin = step === "confirm" ? confirmPin : pin;
  const title = isSetup
    ? step === "confirm" ? "Confirm Your PIN" : "Set a 4-Digit PIN"
    : "Enter Your PIN";
  const subtitle = isSetup
    ? step === "confirm" ? "Re-enter the PIN to confirm" : "This PIN will be required each time you open WealthFlow"
    : "Unlock to continue";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
      <AnimatePresence mode="wait">
        {showForgot ? (
          <ForgotPinForm key="forgot" onReset={handleForgotReset} onBack={() => setShowForgot(false)} />
        ) : (
          <PinKeypad
            key="keypad"
            pin={currentPin}
            maxLength={4}
            title={title}
            subtitle={subtitle}
            error={error}
            onDigit={handleDigit}
            onDelete={handleDelete}
            footer={
              !isSetup ? (
                <div className="space-y-3 text-center">
                  <button
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Forgot PIN?
                  </button>
                  <p className="text-xs text-muted-foreground">
                    <Fingerprint className="h-3.5 w-3.5 inline mr-1" />
                    Biometric unlock coming soon
                  </p>
                  <button
                    onClick={() => signOut()}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1.5 mx-auto"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out &amp; switch account
                  </button>
                </div>
              ) : undefined
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}