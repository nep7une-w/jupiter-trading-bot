/**
 * Jupiter Trading Bot - Entry Point
 * 
 * This is the main entry point for the Jupiter Trading Bot. It initializes the
 * environment and provides an example usage of the trading functionality.
 */

import dotenv from 'dotenv';
import path from 'path';
import { buyAndSellFlow } from './trader';

// Load environment variables from .env file
dotenv.config();

// Simple demonstration of the bot's capabilities
async function main() {
  // Example usage - add your own logic here
  console.log("Jupiter Trading Bot started");
  console.log("Environment:", {
    rpcEndpoint: process.env.RPC_ENDPOINT,
    buyAmount: process.env.BUY_AMOUNT_SOL,
    slippage: process.env.SLIPPAGE_BPS,
    sellDelay: process.env.SELL_DELAY_SECONDS,
    newTokenMode: process.env.NEW_TOKEN_MODE
  });
  
  // Uncomment to execute a buy and sell flow for a specific token
  // const tokenMintAddress = "YOUR_TOKEN_MINT_ADDRESS";
  // await buyAndSellFlow(tokenMintAddress);
  
  console.log("Jupiter Trading Bot completed");
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error("Error in main process:", error);
    process.exit(1);
  });
}

// Export functions for use as a module
export { buyAndSellFlow } from './trader'; 