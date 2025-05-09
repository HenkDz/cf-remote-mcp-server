import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Augment the Cloudflare Env type with our Supabase variables
// The base Cloudflare.Env is typically available globally after wrangler types generation,
// or can be explicitly imported if needed for clarity from worker-configuration.d.ts (though direct import might be complex).
// For simplicity, we define what we expect from Cloudflare.Env here, plus our additions.
export interface Env extends Cloudflare.Env { // Assuming Cloudflare.Env is globally available from worker-configuration.d.ts
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY?: string; // Optional

    // Properties from Cloudflare.Env shown in worker-configuration.d.ts that might be relevant for context
    // OAUTH_KV: KVNamespace; // KVNamespace is a Cloudflare type
    // MCP_OBJECT: DurableObjectNamespace; // DurableObjectNamespace is a Cloudflare type
    // ASSETS: Fetcher; // Fetcher is a Cloudflare type

    // The OAuthProvider itself is often bound to the Env in the worker entry point
    OAUTH_PROVIDER?: { fetch: (req: Request) => Promise<Response> }; // Based on app.ts
}

let supabase: SupabaseClient;

export function getSupabaseClient(env: Env): SupabaseClient {
    if (!supabase) {
        if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
            throw new Error('Supabase URL and Anon Key are required in environment.');
        }
        // TODO: Consider if supabaseClientOptions from original project are needed
        supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    }
    return supabase;
}

// Optional: If you need a service role client for specific operations
let supabaseServiceRole: SupabaseClient;
export function getSupabaseServiceRoleClient(env: Env): SupabaseClient | null {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not provided, service role client will not be available.');
      return null;
    }
    if (!supabaseServiceRole) {
         if (!env.SUPABASE_URL) {
            throw new Error('Supabase URL is required in environment for service role client.');
        }
        // TODO: Consider if supabaseClientOptions from original project are needed
        supabaseServiceRole = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    }
    return supabaseServiceRole;
} 