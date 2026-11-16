import { toLocalISODate } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import { Plane, Plus, MapPin, Calendar, Loader2, Trash2, Eye, ChevronRight, CheckCircle2, RotateCcw, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, Currency, CURRENCY_SYMBOLS } from "@/lib/data";
import { useTrips, useCreateTrip, useDeleteTrip, useUpdateTrip, useTripPlannedExpenses, useCreatePlannedExpense, useDeletePlannedExpense, useTripTransactions, Trip } from "@/hooks/useTrips";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveDialog as Dialog, ResponsiveDialogContent as DialogContent, ResponsiveDialogHeader as DialogHeader, ResponsiveDialogTitle as DialogTitle, ResponsiveDialogTrigger as DialogTrigger,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

const currencies: Currency[] = ["LKR", "USD", "EUR", "GBP", "ILS"];
const categories = ["Accommodation", "Transport", "Food", "Activities", "Shopping", "Insurance", "Visa", "Other"];

function TripDetail({ trip, onBack, onTripUpdated }: { trip: Trip; onBack: () => void; onTripUpdated: (t: Trip) => void }) {
  const { data: planned = [], isLoading: loadingPlanned } = useTripPlannedExpenses(trip.id);
  const { data: actual = [], isLoading: loadingActual } = useTripTransactions(trip.id);
  const createPlanned = useCreatePlannedExpense();
  const deletePlanned = useDeletePlannedExpense();
  const updateTrip = useUpdateTrip();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [cat, setCat] = useState("Accommodation");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [dayNum, setDayNum] = useState("");

  const totalPlanned = planned.reduce((s, e) => s + Number(e.planned_amount), 0);
  // Only count transactions actually in the trip's own currency toward the totals — a
  // transaction logged in a different currency can't be summed with these directly
  // without silently mislabeling the total.
  const actualSameCurrency = actual.filter((tx) => tx.currency === trip.trip_currency);
  const otherCurrencyCount = actual.length - actualSameCurrency.length;
  const totalActual = actualSameCurrency.reduce((s, tx) => s + Number(tx.amount), 0);
  const budgetUsedPct = trip.budget > 0 ? Math.min((totalActual / trip.budget) * 100, 100) : 0;

  const startDate = new Date(trip.start_date);
  const endDate = new Date(trip.end_date);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt) return;
    try {
      await createPlanned.mutateAsync({
        trip_id: trip.id,
        category: cat,
        description: desc || cat,
        planned_amount: amt,
        currency: trip.trip_currency,
        day_number: dayNum ? parseInt(dayNum) : null,
      });
      setAddOpen(false);
      setAmount("");
      setDesc("");
      toast({ title: "Planned expense added!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Group spending by category for planned vs actual comparison
  const categoryComparison = categories.map((cat) => {
    const plannedAmt = planned.filter((p) => p.category === cat).reduce((s, p) => s + Number(p.planned_amount), 0);
    const actualAmt = actualSameCurrency.filter((tx) => tx.category === cat).reduce((s, tx) => s + Number(tx.amount), 0);
    return { category: cat, planned: plannedAmt, actual: actualAmt };
  }).filter((c) => c.planned > 0 || c.actual > 0);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        ← Back to trips
      </button>

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{trip.name}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {trip.destination || "No destination set"}
            </p>
          </div>
          <Badge variant={trip.is_active ? "default" : "secondary"}>
            {trip.is_active ? "Active" : "Completed"}
          </Badge>
        </div>

        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {trip.start_date} → {trip.end_date}</span>
          <span>{totalDays} days</span>
        </div>

        {trip.budget > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>Budget: {formatCurrency(trip.budget, trip.trip_currency as Currency)}</span>
              <span className={totalActual > trip.budget ? "text-destructive" : "text-success"}>
                Spent: {formatCurrency(totalActual, trip.trip_currency as Currency)}
              </span>
            </div>
            <Progress value={budgetUsedPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {formatCurrency(Math.max(trip.budget - totalActual, 0), trip.trip_currency as Currency)} remaining
            </p>
          </div>
        )}

        {trip.notes && <p className="text-sm text-muted-foreground italic">{trip.notes}</p>}

        {/* Complete / Reactivate button */}
        <div className="pt-2 border-t border-border">
          {trip.is_active ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={updateTrip.isPending}
              onClick={async () => {
                await updateTrip.mutateAsync({ id: trip.id, is_active: false });
                onTripUpdated({ ...trip, is_active: false });
                toast({ title: "Trip marked as completed!" });
              }}
            >
              {updateTrip.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Mark as Completed
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              disabled={updateTrip.isPending}
              onClick={async () => {
                await updateTrip.mutateAsync({ id: trip.id, is_active: true });
                onTripUpdated({ ...trip, is_active: true });
                toast({ title: "Trip reactivated!" });
              }}
            >
              {updateTrip.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Reactivate Trip
            </Button>
          )}
        </div>
      </div>

      {/* Trip Summary (shown when completed) */}
      {!trip.is_active && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 space-y-4 border-2 border-primary/20"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Trip Summary</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/50 rounded-xl p-4 space-y-1 text-center">
              <DollarSign className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Budget</p>
              <p className="text-lg font-bold font-mono">
                {trip.budget > 0 ? formatCurrency(trip.budget, trip.trip_currency as Currency) : "—"}
              </p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 space-y-1 text-center">
              <TrendingDown className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Spent</p>
              <p className="text-lg font-bold font-mono">
                {formatCurrency(totalActual, trip.trip_currency as Currency)}
              </p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 space-y-1 text-center">
              <TrendingUp className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Planned</p>
              <p className="text-lg font-bold font-mono">
                {formatCurrency(totalPlanned, trip.trip_currency as Currency)}
              </p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 space-y-1 text-center">
              <Calendar className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {trip.budget > 0 && totalActual <= trip.budget ? "Saved" : "Over Budget"}
              </p>
              <p className={`text-lg font-bold font-mono ${trip.budget > 0 && totalActual > trip.budget ? "text-destructive" : "text-success"}`}>
                {trip.budget > 0
                  ? formatCurrency(Math.abs(trip.budget - totalActual), trip.trip_currency as Currency)
                  : "—"}
              </p>
            </div>
          </div>

          {actualSameCurrency.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              {actualSameCurrency.length} transaction{actualSameCurrency.length !== 1 ? "s" : ""} · Avg {formatCurrency(totalActual / actualSameCurrency.length, trip.trip_currency as Currency)}/transaction
              {totalDays > 0 && ` · ${formatCurrency(totalActual / totalDays, trip.trip_currency as Currency)}/day`}
            </div>
          )}
        </motion.div>
      )}

      {/* Planned vs Actual */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Planned vs Actual</h3>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Plan Expense</Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-glass-border">
              <DialogHeader><DialogTitle>Plan an Expense</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={cat} onValueChange={setCat}>
                    <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Hotel booking" className="bg-secondary" />
                </div>
                <div className="space-y-1.5">
                  <Label>Amount ({CURRENCY_SYMBOLS[trip.trip_currency as Currency] || trip.trip_currency})</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="bg-secondary" required min="0.01" step="0.01" />
                </div>
                <div className="space-y-1.5">
                  <Label>Day # (optional)</Label>
                  <Input type="number" value={dayNum} onChange={(e) => setDayNum(e.target.value)} placeholder="1" className="bg-secondary" min="1" max={totalDays.toString()} />
                </div>
                <Button type="submit" className="w-full" disabled={createPlanned.isPending}>
                  {createPlanned.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Planned Expense
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex justify-between text-sm font-medium border-b border-border pb-2">
          <span>Total Planned: {formatCurrency(totalPlanned, trip.trip_currency as Currency)}</span>
          <span>Total Actual: {formatCurrency(totalActual, trip.trip_currency as Currency)}</span>
        </div>
        {otherCurrencyCount > 0 && (
          <p className="text-[11px] text-warning -mt-2">
            ⚠ {otherCurrencyCount} transaction{otherCurrencyCount !== 1 ? "s" : ""} tagged to this trip in a different
            currency {"aren't"} included in the totals above — see the full list at the bottom.
          </p>
        )}

        {categoryComparison.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No planned or actual expenses yet.</p>
        ) : (
          <div className="space-y-3">
            {categoryComparison.map((c) => {
              const pct = c.planned > 0 ? Math.min((c.actual / c.planned) * 100, 100) : (c.actual > 0 ? 100 : 0);
              return (
                <div key={c.category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{c.category}</span>
                    <span className={c.actual > c.planned && c.planned > 0 ? "text-destructive" : ""}>
                      {formatCurrency(c.actual, trip.trip_currency as Currency)} / {formatCurrency(c.planned, trip.trip_currency as Currency)}
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}

        {/* Planned expense list */}
        {planned.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium tracking-normal">Planned Items</p>
            {planned.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-secondary/30">
                <div>
                  <span className="font-medium">{p.description}</span>
                  <span className="text-muted-foreground ml-2">{p.category}</span>
                  {p.day_number && <span className="text-xs text-muted-foreground ml-2">Day {p.day_number}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{formatCurrency(p.planned_amount, p.currency as Currency)}</span>
                  <button
                    onClick={() => deletePlanned.mutate({ id: p.id, tripId: trip.id })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Spending Breakdown */}
      {actualSameCurrency.length > 0 && (
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-semibold">Daily Breakdown</h3>
          {(() => {
            // Group transactions by date (same-currency only — see note above on Planned vs Actual)
            const byDate: Record<string, { total: number; txs: typeof actualSameCurrency }> = {};
            actualSameCurrency.forEach((tx) => {
              if (!byDate[tx.date]) byDate[tx.date] = { total: 0, txs: [] };
              byDate[tx.date].total += Number(tx.amount);
              byDate[tx.date].txs.push(tx);
            });
            const sortedDates = Object.keys(byDate).sort();
            const maxDaily = Math.max(...sortedDates.map((d) => byDate[d].total));
            const dailyBudget = trip.budget > 0 && totalDays > 0 ? trip.budget / totalDays : 0;

            return (
              <div className="space-y-3">
                {dailyBudget > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Daily budget target: {formatCurrency(dailyBudget, trip.trip_currency as Currency)}/day
                  </p>
                )}
                {sortedDates.map((date) => {
                  const day = byDate[date];
                  const barPct = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
                  const overDailyBudget = dailyBudget > 0 && day.total > dailyBudget;
                  // Calculate day number relative to trip start
                  const dayStart = new Date(trip.start_date);
                  const dayCurrent = new Date(date);
                  const dayNum = Math.ceil((dayCurrent.getTime() - dayStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

                  return (
                    <div key={date} className="space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium bg-secondary/60 rounded px-1.5 py-0.5">Day {dayNum}</span>
                          <span className="text-sm">{dateLabel}</span>
                        </div>
                        <span className={`text-sm font-mono font-semibold ${overDailyBudget ? "text-destructive" : ""}`}>
                          {formatCurrency(day.total, trip.trip_currency as Currency)}
                        </span>
                      </div>
                      <div className="relative h-2 bg-secondary/50 rounded-full overflow-hidden">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full transition-all ${overDailyBudget ? "bg-destructive" : "bg-primary"}`}
                          style={{ width: `${barPct}%` }}
                        />
                        {dailyBudget > 0 && maxDaily > 0 && (
                          <div
                            className="absolute inset-y-0 w-0.5 bg-foreground/30"
                            style={{ left: `${Math.min((dailyBudget / maxDaily) * 100, 100)}%` }}
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {day.txs.map((tx) => (
                          <span key={tx.id} className="text-[10px] text-muted-foreground bg-secondary/40 rounded px-1.5 py-0.5">
                            {tx.category}: {formatCurrency(tx.amount, tx.currency as Currency)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      <div className="glass-card p-5 space-y-3">
        <h3 className="font-semibold">Trip Transactions</h3>
        {actual.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No transactions tagged to this trip yet. Tag transactions from the Transactions page.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {actual.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{tx.category} · {tx.date}</p>
                </div>
                <span className="text-sm font-mono font-semibold text-destructive">
                  -{formatCurrency(tx.amount, tx.currency as Currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TripsPage = () => {
  const { data: trips = [], isLoading } = useTrips();
  const createTrip = useCreateTrip();
  const deleteTrip = useDeleteTrip();
  const { toast } = useToast();

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState(toLocalISODate(new Date()));
  const [endDate, setEndDate] = useState("");
  const [tripCurrency, setTripCurrency] = useState<Currency>("USD");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) return;
    try {
      await createTrip.mutateAsync({
        name,
        destination,
        start_date: startDate,
        end_date: endDate,
        trip_currency: tripCurrency,
        budget: parseFloat(budget) || 0,
        notes,
        is_active: true,
      });
      setAddOpen(false);
      setName("");
      setDestination("");
      setBudget("");
      setNotes("");
      toast({ title: "Trip created!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedTrip) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
        <TripDetail
          trip={selectedTrip}
          onBack={() => setSelectedTrip(null)}
          onTripUpdated={(updated) => setSelectedTrip(updated)}
        />
      </div>
    );
  }

  const activeTrips = trips.filter((t) => t.is_active);
  const pastTrips = trips.filter((t) => !t.is_active);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trips</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> New Trip</Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-glass-border max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Plan a Trip</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Trip Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer vacation" className="bg-secondary" required />
              </div>
              <div className="space-y-1.5">
                <Label>Destination</Label>
                <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Tokyo, Japan" className="bg-secondary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-secondary" required />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-secondary" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Trip Currency</Label>
                  <Select value={tripCurrency} onValueChange={(v) => setTripCurrency(v as Currency)}>
                    <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => <SelectItem key={c} value={c}>{CURRENCY_SYMBOLS[c]} {c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Budget</Label>
                  <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" className="bg-secondary" min="0" step="0.01" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." className="bg-secondary" rows={2} />
              </div>
              <Button type="submit" className="w-full" disabled={createTrip.isPending}>
                {createTrip.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Trip
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {trips.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <Plane className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No trips yet. Plan your first trip!</p>
        </div>
      ) : (
        <>
          {activeTrips.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">Active Trips</h2>
              {activeTrips.map((trip, i) => (
                <TripCard key={trip.id} trip={trip} index={i} onClick={() => setSelectedTrip(trip)} onDelete={() => deleteTrip.mutate(trip.id)} />
              ))}
            </div>
          )}

          {pastTrips.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">Past Trips</h2>
              {pastTrips.map((trip, i) => (
                <TripCard key={trip.id} trip={trip} index={i} onClick={() => setSelectedTrip(trip)} onDelete={() => deleteTrip.mutate(trip.id)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

function TripCard({ trip, index, onClick, onDelete }: { trip: Trip; index: number; onClick: () => void; onDelete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card p-4 flex items-center gap-4 cursor-pointer hover:bg-secondary/30 transition-colors"
      onClick={onClick}
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Plane className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{trip.name}</p>
        <p className="text-xs text-muted-foreground">
          {trip.destination && `${trip.destination} · `}{trip.start_date} → {trip.end_date}
        </p>
      </div>
      <div className="text-right shrink-0">
        {trip.budget > 0 && (
          <p className="text-sm font-mono font-semibold">{formatCurrency(trip.budget, trip.trip_currency as Currency)}</p>
        )}
        <Badge variant={trip.is_active ? "default" : "secondary"} className="text-[10px]">
          {trip.is_active ? "Active" : "Done"}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-destructive p-1">
              <Trash2 className="h-4 w-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="glass-card border-glass-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete trip?</AlertDialogTitle>
              <AlertDialogDescription>This will delete "{trip.name}" and all planned expenses. Transactions won't be deleted but will be unlinked.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.stopPropagation(); onDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </motion.div>
  );
}

export default TripsPage;
