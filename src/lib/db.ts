// This component is from documentation. 

import { PrismaClient } from "@prisma/client";

/**
 * Extended PrismaClient with connection management capabilities
 */
class PrismaClientSingleton extends PrismaClient {
  private isConnected: boolean;
  private connectPromise: Promise<void> | null;
  private reconnectAttempts: number;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectInterval: number;

  constructor() {
    super({
      // You can add Prisma client configurations here
      log: process.env.NODE_ENV === "development" 
        ? ["query", "error", "warn"] 
        : ["error"],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    this.isConnected = false;
    this.connectPromise = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 seconds

    // Connect on init
    this.connect();

    // Handle connection events
    this.setupEventHandlers();
  }

  /**
   * Connect to the database and handle connection state
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    // If already connecting, return the existing promise
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      try {
        await this.$connect();
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log("Database connection established successfully");
      } catch (error) {
        this.isConnected = false;
        console.error("Failed to connect to database:", error);
        await this.handleReconnect();
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  /**
   * Attempt to reconnect to the database
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectInterval / 1000}s...`);
    
    await new Promise(resolve => setTimeout(resolve, this.reconnectInterval));
    await this.connect();
  }

  /**
   * Set up event handlers for process termination to properly disconnect
   */
  private setupEventHandlers(): void {
    // Handle normal exit
    process.on('exit', () => {
      this.disconnect();
    });

    // Handle CTRL+C (SIGINT)
    process.on('SIGINT', () => {
      this.disconnect()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });

    // Handle nodemon/pm2 restarts (SIGUSR2)
    process.on('SIGUSR2', () => {
      this.disconnect()
        .then(() => process.kill(process.pid, 'SIGUSR2'))
        .catch(() => process.exit(1));
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.disconnect()
        .then(() => process.exit(1))
        .catch(() => process.exit(1));
    });
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.$disconnect();
      this.isConnected = false;
      console.log("Database connection closed successfully");
    } catch (error) {
      console.error("Failed to disconnect from database:", error);
      throw error;
    }
  }

  /**
   * Execute a transaction with reconnection capability
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCount = 0,
    maxRetries = 3
  ): Promise<T> {
    try {
      // Ensure connection before executing operation
      await this.connect();
      return await operation();
    } catch (error: any) {
      // Check if error is due to lost connection
      if (
        (error?.code === 'P2023' || error?.code === 'P2024' || error?.code === 'P2025') && 
        retryCount < maxRetries
      ) {
        console.warn(`Database operation failed. Reconnecting... (Attempt ${retryCount + 1}/${maxRetries})`);
        this.isConnected = false;
        await this.connect();
        return this.executeWithRetry(operation, retryCount + 1, maxRetries);
      }
      throw error;
    }
  }
}

// Create the singleton instance
declare global {
  // eslint-disable-next-line no-var, no-unused-vars
  var cachedPrisma: PrismaClientSingleton;
}

let prisma: PrismaClientSingleton;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClientSingleton();
} else {
  if (!global.cachedPrisma) {
    global.cachedPrisma = new PrismaClientSingleton();
  }
  prisma = global.cachedPrisma;
}

// Export the database client instance
export const db = prisma;

// Helper to execute operations with retry logic
export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  return prisma.executeWithRetry(operation);
}