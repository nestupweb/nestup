import { createClient } from "@supabase/supabase-js";
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await admin.from("listings").select("coords_source");
const by = {};
for (const r of data) by[r.coords_source] = (by[r.coords_source] || 0) + 1;
console.log(new Date().toISOString().slice(11,19), JSON.stringify(by));
