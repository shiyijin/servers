import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError, CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "module";
import { ADXHandler } from "./handlers/adx_handler.js";
import { logger, EventType } from "./utils/logger.js";

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
            logger.error("[MCP Error]", error);
            logger.event(EventType.SERVER_ERROR, {
                serverName: this.serverName,
                version: this.version,
                error: error.toString()
            });
        };
        
        process.on("SIGINT", async () => {
            logger.info("Shutting down server...");
            logger.event(EventType.SERVER_SHUTDOWN, {
                serverName: this.serverName,
                version: this.version,
            });
            await this.server.close();
            logger.close();
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
        logger.info("Tools registered:", Object.keys(this.tools));

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

                // Log the event with all dimensions
                logger.event(
                EventType.TOOL_INVOKED,
                {
                    name,
                    duration,
                    status,
                    args: JSON.stringify(args),
                    serverName: this.serverName,
                    version: this.version,
                    ...this.additionalDimensions
                }
                );
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

            if (!params.clusterUrl && !process.env.KUSTO_DEFAULT_CLUSTER) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Cluster URL must be provided either in parameters or via KUSTO_DEFAULT_CLUSTER environment variable"
                );
            }

            if (!params.database && !process.env.KUSTO_DEFAULT_DATABASE) {
                throw new McpError(
                    ErrorCode.InvalidParams,
                    "Database must be provided either in parameters or via KUSTO_DEFAULT_DATABASE environment variable"
                );
            }

            return await this.adxHandler.executeQuery(params);
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
                logger.info(`Strategy 1 - Looking for package.json at: ${packageJsonPath}`);

                if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                logger.info(`Found package.json with version: ${packageJson.version}`);
                return packageJson.version || undefined;
                }
            } catch (e) {
                logger.warn(`Strategy 1 failed: ${e instanceof Error ? e.message : String(e)}`);
            }
            return undefined;
        } catch (error) {
            logger.error('Failed to load package version:', error);
            return undefined;
        }
    }

    public async run() {
        logger.info(`Starting ${this.name} server initialization...`);
        logger.event(EventType.SERVER_STARTED, {
            serverName: this.serverName,
            version: this.version,
            toolCount: Object.keys(this.tools).length
        });

        const startTime = Date.now();

        try {
            // Initialize all handlers before connecting
            logger.info("Initializing handlers...");
            await this.initializeHandlers();
            logger.info("Handlers initialized successfully");

            // Use stdio transport
            logger.info("Creating stdio transport...");
            const transport = new StdioServerTransport();
            
            // Connect to transport
            logger.info("Connecting to transport...");
            await this.server.connect(transport);

            logger.event(EventType.SERVER_CONNECTED, {
                serverName: this.serverName,
                version: this.version,
                totalStartupTime: Date.now() - startTime,
                transportType: 'stdio'
            });

            logger.info(`${this.name} MCP server running on stdio`);
        } catch (error) {
            logger.error(`Failed to start ${this.name} server:`, error);

            logger.event(EventType.SERVER_ERROR, {
                serverName: this.serverName,
                version: this.version,
                error: error instanceof Error ? error.message : String(error),
                phase: 'startup'
            });

            throw error;
        }
    }
}

// Create and run server instance if this is the main module
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))){
    const serverInstance = new ADXServer();
    serverInstance.run().catch(console.error);
}
