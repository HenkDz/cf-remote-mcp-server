import { McpAgent } from 'agents/mcp';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
// Removed import of Env as WorkerEnv from './supabase' as Env is no longer exported from there.
// The Env type for the worker should be globally available from worker-configuration.d.ts or defined elsewhere.
import { createSupabaseClient, createSupabaseServiceRoleClient } from './supabase'; // Updated import to match the actual function names in supabase.ts
import type { SupabaseClient } from '@supabase/supabase-js';

// Import types for your tools if they are complex, e.g.:
// import type { AuthUser, SqlExecutionResult } from './types';

// If McpAgentState is not found, define a basic one or use 'any' for the McpAgent generic
// For now, let's assume the McpAgent is robust enough or McpAgentState is a simpler type.
// We can define it locally if needed: interface MyMcpAgentState { [key: string]: any; }

// Using 'any' for state type if McpAgentState is problematic, to focus on McpAgent import

// Define the state for our agent, including session-specific Supabase config
interface MyMCPState {
    isConfigured: boolean;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    supabaseServiceKey?: string; // Optional
    // Add any other session-specific state you might need
}

// Assuming 'Env' is the correct type for the Cloudflare Worker environment bindings
// It should be available globally or via worker-configuration.d.ts
export class MyMCP extends McpAgent<Env, MyMCPState, Record<string, never>> {
    public server: McpServer;

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.server = new McpServer({
            name: 'cf-dynamic-supabase-mcp',
            version: '1.0.0',
        });
    }

    initialState: MyMCPState = {
        isConfigured: false,
    };

    async init() {
        console.log('MyMCP (Dynamic Supabase Agent) initializing...');
        if (!this.server) {
            console.error("CRITICAL: this.server is NOT initialized!");
            return;
        }
        // Note: Supabase client is NOT initialized here globally anymore.
        // It will be initialized per-tool-call based on session state.

        this.registerConfigureSupabaseInstanceTool();
        this.registerDemoAddTool();
        this.registerListTablesTool();

        console.log('MyMCP (Dynamic Supabase Agent) init complete.');
    }

    // onStateUpdate can be useful for debugging state changes
    // onStateUpdate(newState: MyMCPState, oldState: MyMCPState) { 
    //     console.log('MyMCP state updated:', { old: oldState, new: newState });
    // }

    private registerConfigureSupabaseInstanceTool() {
        if (!this.server) return;
        const configShape = z.object({
            supabaseUrl: z.string().url(),
            supabaseAnonKey: z.string(),
            supabaseServiceKey: z.string().optional(),
        });
        this.server.tool(
            'configure_supabase_instance',
            'Configures the Supabase instance details (URL, anon key, service key) for the current session.',
            configShape.shape, // Pass the raw shape
            async (input) => {
                // Input is validated by the MCP SDK against configShape
                await this.setState({
                    isConfigured: true,
                    supabaseUrl: input.supabaseUrl,
                    supabaseAnonKey: input.supabaseAnonKey,
                    supabaseServiceKey: input.supabaseServiceKey,
                });
                return { content: [{ type: 'text', text: `Session configured for Supabase instance: ${input.supabaseUrl}` }] };
            }
        );
        console.log('Registered tool: configure_supabase_instance');
    }

    private registerDemoAddTool() {
        if (!this.server) return;
        const addToolShape = { a: z.number(), b: z.number() };
        this.server.tool(
            "add",
            "Adds two numbers.", 
            addToolShape, 
            async (input) => {
                const { a, b } = input;
                return { content: [{ type: "text", text: String(a + b) }] };
            }
        );
        console.log('Registered demo tool: add');
    }

    private registerListTablesTool() {
        if (!this.server) return;
        const ListTablesOutputSchema = z.array(z.object({
            schema: z.string(),
            name: z.string(),
            comment: z.string().nullable().optional(),
        }));
        const listTablesSql = `SELECT n.nspname as schema, c.relname as name, pgd.description as comment FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = c.oid AND pgd.objsubid = 0 WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast') AND n.nspname NOT LIKE 'pg_temp_%' AND n.nspname NOT LIKE 'pg_toast_temp_%' AND n.nspname NOT IN ('auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'pgbouncer', 'realtime', 'supabase_functions', 'supabase_migrations', '_realtime') AND has_schema_privilege(n.oid, 'USAGE') AND has_table_privilege(c.oid, 'SELECT') ORDER BY n.nspname, c.relname`;

        this.server.tool(
            'list_tables',
            'Lists all accessible tables in the configured Supabase database.',
            {}, 
            async (_input) => {
                if (!this.state.isConfigured || !this.state.supabaseUrl || !this.state.supabaseAnonKey) {
                    return { content: [{type: 'text', text: 'Error: Supabase instance not configured for this session. Please call \'configure_supabase_instance\' first.'}], _meta: { isError: true } };
                }
                const supabase = createSupabaseClient(this.state.supabaseUrl, this.state.supabaseAnonKey);
                
                // Example for service role client, if needed later. Ensure supabaseServiceKey is present in state.
                // const adminSupabase = this.state.supabaseServiceKey 
                //    ? createSupabaseServiceRoleClient(this.state.supabaseUrl, this.state.supabaseServiceKey)
                //    : null;

                try {
                    const { data, error } = await supabase.rpc('execute_sql', { query: listTablesSql });
                    if (error) {
                        console.error('Error from list_tables RPC:', error);
                        return { content: [{type: 'text', text: `Failed to list tables: ${error.message}`}], _meta: { isError: true } };
                    }
                    const parseResult = ListTablesOutputSchema.safeParse(data);
                    if (!parseResult.success) {
                        console.error('Failed to parse list_tables output:', parseResult.error);
                        return { content: [{type: 'text', text: 'Failed to parse list_tables output.'}], _meta: { isError: true } };
                    }
                    return { content: [{ type: 'text', text: JSON.stringify(parseResult.data, null, 2) }] }; 
                } catch (e: any) {
                    console.error('Exception in list_tables tool:', e);
                    return { content: [{type: 'text', text: `Exception: ${e.message}`}], _meta: { isError: true } };
                }
            }
        );
        console.log('Registered tool: list_tables');
    }

    // Placeholder for a tool registration method
    /*
    private registerListTablesTool() {
        if (!this.server) return; // Guard
        this.server.tool(
            'list_tables',
            'Lists tables in the public schema.',
            z.object({ schemaName: z.string().optional().default('public') }),
            async (input) => {
                const supabase = getSupabaseClient(this.env as Env);
                // ... tool logic ...
                return { tables: [] }; // Placeholder
            }
        );
    }
    */
} 