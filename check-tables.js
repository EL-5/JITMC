const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');

loadEnvConfig(process.cwd());
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkTables() {
  console.log("Checking if tables exist...");
  const { data, error } = await supabase.from('form_fields').select('id').limit(1);
  if (error) {
    console.error("Error querying form_fields:", error.message, error.code);
  } else {
    console.log("form_fields table exists!");
  }
  
  const { data: subData, error: subError } = await supabase.from('submissions').select('id').limit(1);
  if (subError) {
    console.error("Error querying submissions:", subError.message, subError.code);
  } else {
    console.log("submissions table exists!");
  }
}

checkTables();
