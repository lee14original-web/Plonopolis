import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vwgfoevjiliggsgmqacg.supabase.co";
const supabaseAnonKey = "sb_publishable_ikeRxy6AzoNQuIeoeF9aww_4FideNeP";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
