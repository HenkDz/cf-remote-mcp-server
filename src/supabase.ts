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

// TODO: Consider if supabaseClientOptions from original project are needed
// const supabaseClientOptions = {
//   auth: {
//     autoRefreshToken: false,
//     persistSession: false,
//     detectSessionInUrl: false,
//   },
// };

export function createSupabaseClient(supabaseUrl: string, supabaseAnonKey: string): SupabaseClient {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase URL and Anon Key are required to create a client.');
    }
    // When/if supabaseClientOptions are needed, pass them as the third argument to createClient
    return createClient(supabaseUrl, supabaseAnonKey);
}

export function createSupabaseServiceRoleClient(supabaseUrl: string, supabaseServiceKey: string): SupabaseClient {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase URL and Service Role Key are required to create a service role client.');
    }
    // When/if supabaseClientOptions are needed, pass them as the third argument to createClient
    return createClient(supabaseUrl, supabaseServiceKey);
}

// The Env interface and the old getSupabaseClient / getSupabaseServiceRoleClient functions
// that relied on environment variables and global client instances have been removed.
// Client creation is now dynamic based on credentials passed at runtime. 