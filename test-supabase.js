const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local
loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("❌ Missing Supabase keys in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkConnection() {
  console.log("Testing connection to:", url);
  try {
    // Try to query the form_fields table
    const { data, error } = await supabase.from('form_fields').select('id').limit(1);
    
    if (error) {
      console.error("❌ Connection failed! Error:", error.message);
    } else {
      console.log("✅ Connection successful! Supabase is fully connected and ready.");
    }
  } catch (err) {
    console.error("❌ Unexpected error:", err);
  }
}

checkConnection();
