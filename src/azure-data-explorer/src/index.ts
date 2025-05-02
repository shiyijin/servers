import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError, CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "module";
import { ADXHandler } from "./handlers/adx_handler.js";

import * as fs from 'node:fs';
import * as path from 'node:path';

const require = createRequire(import.meta.url);

export class ADXServer {
    protected server: Server;
    protected name: string;
    protected version: string;
    protected tools: Record<string, any>;
    protected serverName: string;
    protected additionalDimensions: Record<string, any>;
    private adxHandler: ADXHandler;

    constructor() {
        this.name = "ADX";
        this.tools = require("./schemas/adx.json");
        this.serverName = "adx_server";
        this.version = this.loadPackageVersion() || "0.1.5";
        this.additionalDimensions = {};
        this.adxHandler = new ADXHandler();

        this.server = new Server(
            {
                name: this.name,
                version: this.version,
            },
            {
                capabilities: {
                tools: this.tools,
                },
            }
        );

        // Error handling
        this.server.onerror = (error) => {
            console.error("[MCP Error]", error);
        };
        
        process.on("SIGINT", async () => {
            console.info("Shutting down server...");
            await this.server.close();
            process.exit(0);
        });
    }

    protected async initializeHandlers(): Promise<void> {
        await this.adxHandler.initialize();
        this.setupToolHandlers();
    }

    protected setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: Object.values(this.tools),
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            // Add timing and event logging
            const startTime = Date.now();
            let status = "success";
            let result;

            try {
                result = await this.handleToolCall(name, args);
            } catch (error) {
                status = "failure";
                throw error;
            } finally {
                const endTime = Date.now();
                const duration = endTime - startTime;
            }

            return result;
        });
    }
    
    protected async handleToolCall(name: string, args: any) {
        if (name === "execute_kusto_query") {
            const params = {
                query: args.query,
                database: args.database,
                clusterUrl: args.clusterUrl,
            };

            if (!params.clusterUrl && !process.env.ADX_DEFAULT_CLUSTER) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Cluster URL must be provided either in parameters or via ADX_DEFAULT_CLUSTER environment variable"
                );
            }

            if (!params.database && !process.env.ADX_DEFAULT_DATABASE) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Database must be provided either in parameters or via ADX_DEFAULT_DATABASE environment variable"
                );
            }

            return await this.adxHandler.executeQuery(params);
        }
        if (name === "list_tables") {
            const params = {
                database: args.database,
                clusterUrl: args.clusterUrl,
            };

            if (!params.clusterUrl && !process.env.ADX_DEFAULT_CLUSTER) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Cluster URL must be provided either in parameters or via ADX_DEFAULT_CLUSTER environment variable"
                );
            }

            if (!params.database && !process.env.ADX_DEFAULT_DATABASE) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Database must be provided either in parameters or via ADX_DEFAULT_DATABASE environment variable"
                );
            }

            return await this.adxHandler.listTables(params);
        }
        if (name === "get_table_schema") {
            const params = {
                database: args.database,
                clusterUrl: args.clusterUrl,
                table: args.table,
            };

            if (!params.clusterUrl && !process.env.ADX_DEFAULT_CLUSTER) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Cluster URL must be provided either in parameters or via ADX_DEFAULT_CLUSTER environment variable"
                );
            }

            if (!params.database && !process.env.ADX_DEFAULT_DATABASE) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Database must be provided either in parameters or via ADX_DEFAULT_DATABASE environment variable"
                );
            }

            return await this.adxHandler.getTableSchema(params);
        }

        throw new McpError(ErrorCode.InvalidParams, `Unknown tool name: ${name}`);
    }

    private loadPackageVersion(): string | undefined {
        try {
            // Try multiple strategies to find the package.json

            // Strategy 1: Using import.meta.url (ES modules approach)
            let packageJsonPath: string | null = null;
            try {
                const currentFileUrl = import.meta.url;
                const currentPathname = new URL(currentFileUrl).pathname;

                // Fix Windows paths by removing leading slash from pathname
                const currentFilePath = process.platform === 'win32'
                ? currentPathname.substring(1)  // Remove leading slash on Windows
                : currentPathname;

                const dirPath = path.dirname(currentFilePath);

                // Navigate up from the current directory to find the package.json
                packageJsonPath = path.resolve(dirPath, '..', 'package.json');

                if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                return packageJson.version || undefined;
                }
            } catch (e) {
                console.warn(`Strategy 1 failed: ${e instanceof Error ? e.message : String(e)}`);
            }
            return undefined;
        } catch (error) {
            console.error('Failed to load package version:', error);
            return undefined;
        }
    }

    public async run() {
        const startTime = Date.now();

        try {
            // Initialize all handlers before connecting
            await this.initializeHandlers();
            
            // Use stdio transport
            const transport = new StdioServerTransport();
            
            // Connect to transport
            await this.server.connect(transport);
        } catch (error) {
            console.error(`Failed to start ${this.name} server:`, error);
            throw error;
        }
    }
}

// Create and run server instance if this is the main module
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))){
    const serverInstance = new ADXServer();
    serverInstance.run().catch(console.error);
}
