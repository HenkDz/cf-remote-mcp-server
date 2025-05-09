import app from "./app";
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { MyMCP } from "./MySupabaseMcpAgent";

// Export the OAuth handler as the default
export default new OAuthProvider({
	apiRoute: "/sse",
	// TODO: Investigate and fix these @ts-ignore directives if possible.
	// It implies that MyMCP.mount("/sse") or app might not perfectly match
	// the expected type for apiHandler or defaultHandler.
	// @ts-ignore
	apiHandler: MyMCP.mount("/sse"),
	// @ts-ignore
	defaultHandler: app,
	authorizeEndpoint: "/authorize",
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
});

// Also, MyMCP needs to be exported for the Durable Object binding to work.
// The Durable Object binding in wrangler.jsonc is: "class_name": "MyMCP"
// So, the class imported and used by the runtime needs to be exported with this name.
export { MyMCP };
