const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');

loadEnvConfig(process.cwd());
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspectSupabaseErrors() {
  console.log("--- Testing form_fields ---");
  const res1 = await supabase.from('form_fields').select('*').limit(1);
  if (res1.error) console.error("form_fields error:", JSON.stringify(res1.error, null, 2));
  else console.log("form_fields success. Count:", res1.data.length);

  console.log("\n--- Testing submissions ---");
  const res2 = await supabase.from('submissions').select('*').limit(1);
  if (res2.error) console.error("submissions error:", JSON.stringify(res2.error, null, 2));
  else console.log("submissions success. Count:", res2.data.length);

  console.log("\n--- Testing submission_values ---");
  const res3 = await supabase.from('submission_values').select('*').limit(1);
  if (res3.error) console.error("submission_values error:", JSON.stringify(res3.error, null, 2));
  else console.log("submission_values success. Count:", res3.data.length);

  console.log("\n--- Testing insert submission ---");
  const res4 = await supabase.from('submissions').insert({
    id: require('crypto').randomUUID(),
    created_at: new Date().toISOString()
  });
  if (res4.error) console.error("insert submission error:", JSON.stringify(res4.error, null, 2));
  else console.log("insert submission success.");
}

inspectSupabaseErrors();
