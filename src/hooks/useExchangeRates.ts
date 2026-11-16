import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EXCHANGE_RATES, Currency } from "@/lib/data";

export function useExchangeRates() {
  return useQuery({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      // Try fetching from DB first
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("*")
        .eq("base_currency", "LKR")
        .maybeSingle();

      if (error) throw error;

      if (data?.rates && typeof data.rates === "object") {
        return data.rates as Record<string, number>;
      }

      // Fallback to hardcoded
      return EXCHANGE_RATES as Record<string, number>;
    },
    staleTime: 1000 * 60 * 30, // 30 min
    refetchOnWindowFocus: false,
  });
}

/** Helper: use live rates with fallback */
export function useConvertToBase() {
  const { data: rates } = useExchangeRates();

  return (amount: number, fromCurrency: Currency): number => {
    const rate = rates?.[fromCurrency] ?? EXCHANGE_RATES[fromCurrency];
    return amount * rate;
  };
}
