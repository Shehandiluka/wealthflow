import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Free API — no key needed
    const res = await fetch(
      "https://open.er-api.com/v6/latest/LKR"
    );
    const apiData = await res.json();

    if (apiData.result !== "success") {
      throw new Error("Exchange rate API returned an error");
    }

    // We store how many LKR = 1 unit of foreign currency
    // The API gives us 1 LKR = X foreign, so we invert
    const currencies = ["USD", "EUR", "GBP", "ILS"];
    const rates: Record<string, number> = { LKR: 1 };

    for (const cur of currencies) {
      const rateFromLKR = apiData.rates[cur];
      if (rateFromLKR && rateFromLKR > 0) {
        rates[cur] = Math.round((1 / rateFromLKR) * 100) / 100;
      }
    }

    console.log("Fetched rates:", rates);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upsert single row
    const { error: dbError } = await supabase
      .from("exchange_rates")
      .upsert(
        {
          base_currency: "LKR",
          rates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "base_currency" }
      );

    if (dbError) throw dbError;

    return new Response(JSON.stringify({ success: true, rates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
