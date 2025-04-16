import { Client as KustoClient, KustoConnectionStringBuilder, ClientRequestProperties } from "azure-kusto-data";
import { AzureCliCredential } from "@azure/identity";

export interface KustoQueryParams {
  query: string;
  database?: string;
  clusterUrl?: string;
}

export class KustoHandler {
  private currentClusterUrl: string | null = null;
  private kustoClient: KustoClient | null = null;
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    try {
      this.initialized = true;
      console.log('KustoHandler initialized successfully');
    } catch (error) {
      console.error('Failed to initialize KustoHandler:', error);
      throw error;
    }
  }

  private formatClusterUrl(cluster: string): string {
    // If it's already a full URL, return as is
    if (cluster.startsWith('https://')) {
      return cluster;
    }
    // Otherwise, format as Kusto cluster URL
    return `https://${cluster}.kusto.windows.net`;
  }

  private async getClient(clusterUrl: string): Promise<KustoClient> {
    try {
      const formattedUrl = this.formatClusterUrl(clusterUrl);
      
      // Reinitialize client if cluster URL has changed
      if (!this.kustoClient || this.currentClusterUrl !== formattedUrl) {
        console.log(`Initializing new Kusto client for cluster: ${formattedUrl}`);
        const credential = new AzureCliCredential();
        await credential.getToken(`${formattedUrl}/.default`);
        const kcsb = KustoConnectionStringBuilder.withTokenCredential(formattedUrl, credential);
        this.kustoClient = new KustoClient(kcsb);
        this.currentClusterUrl = formattedUrl;
      }
      
      return this.kustoClient;
    } catch (error) {
      console.error('Error creating Kusto client:', error);
      throw error;
    }
  }

  private prepareResponseObj(params: KustoQueryParams, success: boolean, data?: any[], error?: string) {
    const clusterUrl = params.clusterUrl || process.env.KUSTO_DEFAULT_CLUSTER || '';
    const database = params.database || process.env.KUSTO_DEFAULT_DATABASE || '';

    const baseResponse = {
      success,
      input: {
        clusterUrl: this.formatClusterUrl(clusterUrl),
        database,
        query: params.query
      }
    };

    if (success && data) {
      return {
        ...baseResponse,
        data,
        message: `Query executed successfully. Retrieved ${data.length} rows.`
      };
    }
    
    return {
      ...baseResponse,
      error: error || 'Unknown error occurred while executing Kusto query'
    };
  }

  async executeQuery(params: KustoQueryParams): Promise<any> {
    try {
      if (!this.initialized) {
        throw new Error('KustoHandler not initialized. Call initialize() first.');
      }

      // Validate required parameters
      if (!params.clusterUrl && !process.env.KUSTO_DEFAULT_CLUSTER) {
        throw new Error('Cluster URL must be provided either in parameters or via KUSTO_DEFAULT_CLUSTER environment variable');
      }

      if (!params.database && !process.env.KUSTO_DEFAULT_DATABASE) {
        throw new Error('Database must be provided either in parameters or via KUSTO_DEFAULT_DATABASE environment variable');
      }

      const clusterUrl = params.clusterUrl || process.env.KUSTO_DEFAULT_CLUSTER!;
      const database = params.database || process.env.KUSTO_DEFAULT_DATABASE!;

      const client = await this.getClient(clusterUrl);
      const properties = new ClientRequestProperties();
      const results = await client.execute(database, params.query, properties);

      const rawString = results.primaryResults[0].toString();
      const rawData = JSON.parse(rawString);
      const rowData = rawData.data || [];

      const responseObj = this.prepareResponseObj(params, true, rowData);
      const responseText = JSON.stringify(responseObj, null, 2);
      console.log('Response:', responseText); // Debug log

      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };

    } catch (error: any) {
      const responseObj = this.prepareResponseObj(params, false, undefined, error.message);
      const responseText = JSON.stringify(responseObj, null, 2);

      return {
        content: [{
          type: 'text',
          text: responseText
        }],
        isError: true
      };
    }
  }
}