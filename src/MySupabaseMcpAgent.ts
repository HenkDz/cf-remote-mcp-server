import { McpAgent } from 'agents/mcp';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import type { Env } from './supabase'; // Our augmented Env type
import { getSupabaseClient, getSupabaseServiceRoleClient } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

// Import types for your tools if they are complex, e.g.:
// import type { AuthUser, SqlExecutionResult } from './types';

// If McpAgentState is not found, define a basic one or use 'any' for the McpAgent generic
// For now, let's assume the McpAgent is robust enough or McpAgentState is a simpler type.
// We can define it locally if needed: interface MyMcpAgentState { [key: string]: any; }

// Using 'any' for state type if McpAgentState is problematic, to focus on McpAgent import
export class MyMCP extends McpAgent<Env, any, Record<string, never>> {
    // Initialize the McpServer instance to satisfy the abstract member requirement
    public server: McpServer; // Use the directly imported McpServer type

    constructor(state: DurableObjectState, env: Env) { // Common DO constructor signature
        super(state, env); // Pass to McpAgent constructor
        this.server = new McpServer({ // Initialize with the imported McpServer
            name: 'cf-remote-supabase-mcp',
            version: '1.0.0',
        });
    }

    initialState: any = {}; // Using 'any' for now

    async init() {
        console.log('MyMCP (Supabase Agent) initializing...');
        // this.server should now be initialized
        if (!this.server) {
            console.error("CRITICAL: this.server is NOT initialized after constructor!");
            return; // Can't register tools if server isn't there
        }

        try {
            const currentEnv = this.env as Env; // McpAgent base class should provide this.env
            const userClient = getSupabaseClient(currentEnv);
            if (!userClient) {
                console.error('Failed to initialize Supabase user client in MyMCP init.');
            }
        } catch (e: any) {
            console.error('Error initializing Supabase client in MyMCP init:', e.message);
        }
        
        // --- TOOL REGISTRATION WILL GO HERE ---
        // Example: this.registerListTablesTool(); 
        this.registerDemoAddTool(); // Keep the demo tool for now for testing
        this.registerListTablesTool(); // Call the new tool registration method

        console.log('MyMCP (Supabase Agent) init complete.');
    }

    onStateUpdate(state: any) { // Using 'any' for now
        console.log('MyMCP (Supabase Agent) state updated:', state);
    }

    // Demo tool from the original index.ts, kept for initial testing
    private registerDemoAddTool() {
        if (!this.server) return;
        const addToolShape = { a: z.number(), b: z.number() }; // Defined the raw shape
        this.server.tool(
            "add",
            "Adds two numbers.", 
            addToolShape, // Pass the raw Zod shape
            async (input) => { // Input type should be inferred from addToolShape
                const { a, b } = input; // Destructure validated and typed input
                return {
    			    content: [{ type: "text", text: String(a + b) }],
    			};
            }
        );
        console.log('Registered demo tool: add');
    }

    private registerListTablesTool() {
        if (!this.server) return;

        // Define ListTablesOutputSchema inside the method or ensure it's properly scoped if outside
        const ListTablesOutputSchema = z.array(z.object({
            schema: z.string(),
            name: z.string(),
            comment: z.string().nullable().optional(),
        }));

        const listTablesSql = `
            SELECT
                n.nspname as schema,
                c.relname as name,
                pgd.description as comment
            FROM
                pg_catalog.pg_class c
            JOIN
                pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            LEFT JOIN
                pg_catalog.pg_description pgd ON pgd.objoid = c.oid AND pgd.objsubid = 0
            WHERE
                c.relkind = 'r'
                AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
                AND n.nspname NOT LIKE 'pg_temp_%'
                AND n.nspname NOT LIKE 'pg_toast_temp_%'
                AND n.nspname NOT IN ('auth', 'storage', 'extensions', 'graphql', 'graphql_public', 'pgbouncer', 'realtime', 'supabase_functions', 'supabase_migrations', '_realtime')
                AND has_schema_privilege(n.oid, 'USAGE')
                AND has_table_privilege(c.oid, 'SELECT')
            ORDER BY
                n.nspname,
                c.relname
        `;

        this.server.tool(
            'list_tables',
            'Lists all accessible tables in the connected database, grouped by schema.',
            {}, // No input parameters for this tool, so raw shape is empty object
            async (_input) => { // input is an empty object, can be ignored or typed as Record<string, never>
                const supabase = getSupabaseClient(this.env as Env);
                if (!supabase) {
                    // Return an MCP error structure
                    return { content: [{type: 'text', text: 'Error: Supabase client not available.'}], _meta: { isError: true } };
                }

                try {
                    const { data, error } = await supabase.rpc('execute_sql', { query: listTablesSql });

                    if (error) {
                        console.error('Error from list_tables RPC:', error);
                        // Return an MCP error structure
                        return { content: [{type: 'text', text: `Failed to list tables: ${error.message}`}], _meta: { isError: true } };
                    }

                    // Validate and structure the output (simplified from handleSqlResponse)
                    // The RPC function execute_sql is expected to return an array of records.
                    const parseResult = ListTablesOutputSchema.safeParse(data);
                    if (!parseResult.success) {
                        console.error('Failed to parse list_tables output:', parseResult.error);
                        return { content: [{type: 'text', text: 'Failed to parse list_tables output.'}], _meta: { isError: true } };
                    }

                    // Return data as a JSON string within a "text" content type
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