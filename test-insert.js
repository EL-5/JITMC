const { loadEnvConfig } = require('@next/env');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

loadEnvConfig(process.cwd());
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testInsert() {
  const dummyId = crypto.randomUUID();
  console.log("Trying to insert submission:", dummyId);
  
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      id: dummyId,
      created_at: new Date().toISOString(),
      synced_at: new Date().toISOString()
    });

  if (error) {
    console.error("Insert failed!");
    console.error("Error details:", JSON.stringify(error, null, 2));
    console.error("Raw error:", error);
  } else {
    console.log("Insert succeeded!", data);
  }
}

testInsert();
