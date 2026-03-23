import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wvgfoevjljggsmgqacg.supabase.co";
const supabaseAnonKey = "TU_WKLEJ_SWÓJ_ANON_KEY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
