# Azure Data Explorer MCP Server

An MCP server implementation for querying data from Azure Data Explorer using KQL(Kusto Query Language).

## Features

- **Query Execution**: Execute KQL (Kusto Query Language) queries on Azure Data Explorer.

## Tools

- **execute_kusto_query**
  - Execute a Kusto query against a specified or default cluster and database".
  - Inputs:
    - `query` (string): The Kusto query to execute.
    - `database` (string, optional): The database to query (optional if KUSTO_DEFAULT_DATABASE environment variable is set).
    - `clusterUrl` (string, optional): The Kusto cluster URL (optional if KUSTO_DEFAULT_CLUSTER environment variable is set).

## Configuration

### Setting up Azure Credentials

1. Ensure that you have already logged in via the 'az' tool using the command "az login" from the commandline.

### Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

#### NPX

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/kusto"
      ],
      "env": {
        "KUSTO_DEFAULT_CLUSTER": "YOUR_KUSTO_CLUSTER_HERE",
        "KUSTO_DEFAULT_DATABASE": "YOUR_DATABASE_HERE"
      }
    }
  }
}
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.