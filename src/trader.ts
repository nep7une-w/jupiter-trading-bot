/**
 * Trader Module
 * 
 * Core trading functionality for the Jupiter Trading Bot.
 * This module contains functions for buying and selling tokens on Solana
 * using Jupiter Aggregator.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import { QuoteGetRequest, QuoteResponse } from '@jup-ag/api';

// Import utilities
import { getConfig, getWallet, SOL_MINT, toLamports } from "./utils/config";
import { executeSwapSafely, getSwapResponse, safeSellAndClose } from "./utils/swap";
import { getTokenBalance, waitForBalanceChange, getTokenDecimals } from "./utils/tokens";
import { delay } from "./utils/helpers";
import { jupiterQuoteApi } from "./utils/api";
import { calculateSlippage } from "./utils/slippage";

/**
 * Buy tokens with SOL
 * @param outputMint Token mint address to buy
 * @param isNewToken Optional flag for special handling of new tokens
 * @returns Transaction signature
 */
export async function buy(
    outputMint: string,
    isNewToken?: boolean
): Promise<string> {
    const config = getConfig();
    const amountLamports = toLamports(parseFloat(config.BUY_AMOUNT_SOL || "0"));
    const wallet = getWallet();

    // Validate token address
    try {
        new PublicKey(outputMint);
    } catch {
        throw new Error(`Invalid token mint address: ${outputMint}`);
    }

    console.log(`Buy params: 
        inputMint: ${SOL_MINT}
        outputMint: ${outputMint}
        amount: ${amountLamports} lamports (${config.BUY_AMOUNT_SOL} SOL)
        slippage: ${calculateSlippage(isNewToken ?? config.NEW_TOKEN_MODE === "true")} bps
    `);

    const params: QuoteGetRequest = {
        inputMint: SOL_MINT,
        outputMint,
        amount: amountLamports,
        slippageBps: calculateSlippage(isNewToken ?? config.NEW_TOKEN_MODE === "true"),
    };

    try {
        console.log("Fetching quote...");
        const quote = await jupiterQuoteApi.quoteGet(params);
        
        if (!quote || !quote.outAmount || BigInt(quote.outAmount) <= 0) {
            throw new Error("Invalid quote received - possible insufficient liquidity");
        }
        
        console.log("Quote received:", {
            inputAmount: quote.inAmount,
            outputAmount: quote.outAmount,
            priceImpact: quote.priceImpactPct,
            route: quote.routePlan?.map(r => `${r.swapInfo?.label} (${r.percent}%)`).join(" -> ")
        });
        
        return await executeSwapSafely(
            new Connection(config.RPC_ENDPOINT),
            quote,
            wallet
        );
    } catch (error) {
        console.error("Detailed quote error:", {
            params,
            error: error instanceof Error ? error.message : JSON.stringify(error)
        });
        throw error;
    }
}

/**
 * Sell tokens for SOL
 * @param inputMint Token mint address to sell
 * @param amount Amount of tokens to sell
 * @param isNewToken Optional flag for special handling of new tokens
 * @returns Transaction signature
 */
export async function sell(
    inputMint: string, 
    amount: number,
    isNewToken?: boolean
): Promise<string> {
    const config = getConfig();
    const wallet = getWallet();
    const connection = new Connection(config.RPC_ENDPOINT);
    
    const params: QuoteGetRequest = {
        inputMint,
        outputMint: SOL_MINT,
        amount: toLamports(amount, await getTokenDecimals(connection, new PublicKey(inputMint))),
        slippageBps: calculateSlippage(isNewToken ?? config.NEW_TOKEN_MODE === "true")
    };

    try {
        console.log(`Sell params: 
            inputMint: ${inputMint}
            outputMint: ${SOL_MINT}
            amount: ${params.amount}
            slippage: ${params.slippageBps} bps
        `);

        const quote = await jupiterQuoteApi.quoteGet(params);
        
        if (!quote || !quote.outAmount || BigInt(quote.outAmount) <= 0) {
            throw new Error("Invalid sell quote received - possible insufficient liquidity");
        }
        
        console.log("Sell quote received:", {
            inputAmount: quote.inAmount,
            outputAmount: quote.outAmount,
            priceImpact: quote.priceImpactPct,
        });
        
        return await executeSwapSafely(connection, quote, wallet);
    } catch (error) {
        console.error("Sell error:", error instanceof Error ? error.message : JSON.stringify(error));
        throw error;
    }
}

/**
 * Generic retry function for async operations
 * @param fn Function to retry
 * @param operationName Name of the operation for logging
 * @param maxRetries Maximum number of retry attempts
 * @param initialDelay Initial delay between retries (ms)
 * @param useExponentialBackoff Whether to use exponential backoff
 * @returns Result of the operation
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    operationName: string = 'Operation',
    maxRetries: number = 3,
    initialDelay: number = 1000,
    useExponentialBackoff: boolean = true
): Promise<T> {
    let lastError: unknown;

    console.log(`[${operationName}] Starting (max retries: ${maxRetries}, initial delay: ${initialDelay}ms)`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const delayMs = useExponentialBackoff ? initialDelay * Math.pow(2, attempt - 1) : initialDelay;

        try {
            console.log(`[${operationName}] Attempt ${attempt}/${maxRetries}...`);
            const result = await fn();
            console.log(`[${operationName}] Attempt ${attempt} succeeded!`);
            return result;
        } catch (error) {
            lastError = error;
            const willRetry = attempt < maxRetries;

            console.error(
                `[${operationName}] Attempt ${attempt} failed: ${error instanceof Error ? error.message : error}`
            );

            if (willRetry) {
                console.log(`[${operationName}] Waiting ${delayMs}ms before next attempt...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    console.error(`[${operationName}] All ${maxRetries} attempts failed`);
    throw lastError ?? new Error(`${operationName} failed with unknown error`);
}

/**
 * Checks if a token is available for trading on Jupiter
 * @param mintAddress Token mint address to check
 * @returns Boolean indicating whether the token is available
 */
export async function checkTokenAvailability(mintAddress: string): Promise<boolean> {
    const maxRetryDurationMs = 60 * 1000; // 1 minute total retry time
    const retryIntervalMs = 1000; // 1 second retry interval
    const startTime = Date.now();
    let attempt = 0;

    while (Date.now() - startTime < maxRetryDurationMs) {
        attempt++;
        try {
            const response = await jupiterQuoteApi.quoteGet({
                inputMint: SOL_MINT,
                outputMint: mintAddress,
                amount: toLamports(0.01), // Use minimal amount to check
                slippageBps: 10000
            });
            
            if (!response) {
                console.log(`Token ${mintAddress} has no available routes`);
                return false;
            }
            
            console.log(`Token ${mintAddress} is available. Best route:`);
            console.log(`- Input: ${response.inAmount} (${response.inputMint})`);
            console.log(`- Output: ${response.outAmount} (${response.outputMint})`);
            console.log(`- Price impact: ${response.priceImpactPct}%`);
            
            return true;
        } catch (error) {
            console.error(`Attempt ${attempt} failed for token ${mintAddress}:`, error instanceof Error ? error.message : JSON.stringify(error));
            
            // If not the last attempt, wait
            if (Date.now() - startTime + retryIntervalMs < maxRetryDurationMs) {
                await delay(retryIntervalMs);
            }
        }
    }
    
    console.error(`Failed to check token ${mintAddress} after ${attempt} attempts within 1 minute`);
    return false;
}

/**
 * Complete buy and sell flow for a token
 * @param tokenMint Token mint address
 * @param buyAmountSOL Optional override for buy amount in SOL
 */
export async function buyAndSellFlow(tokenMint: string, buyAmountSOL?: number): Promise<void> {
    try {
        const wallet = getWallet();
        const config = getConfig();
        const connection = new Connection(config.RPC_ENDPOINT);
        const isNewToken = config.NEW_TOKEN_MODE === "true";
        
        console.log("Wallet:", wallet.publicKey.toBase58());
        console.log(`New Token Mode: ${isNewToken}`);
        
        // 1. Use safe buy
        const originalBuyAmount = config.BUY_AMOUNT_SOL;
        if (buyAmountSOL !== undefined) {
            process.env.BUY_AMOUNT_SOL = buyAmountSOL.toString();
        }
        
        console.log(`Buying ${config.BUY_AMOUNT_SOL} SOL worth of ${tokenMint}...`);
        try {
            const buyTx = await withRetry(
                () => buy(tokenMint, isNewToken),
                'TokenPurchase',
                3,
                1000
            );
            console.log("Buy transaction successful:", buyTx);
        } catch (error) {
            console.error("Final failure after all retries:", error);
            throw error;
        }

        if (buyAmountSOL !== undefined) {
            process.env.BUY_AMOUNT_SOL = originalBuyAmount;
        }
        
        // 2. Wait and check balance
        const retryCount = config.BALANCE_RETRY_COUNT ? parseInt(config.BALANCE_RETRY_COUNT) : 5;
        const retryDelay = config.BALANCE_RETRY_DELAY_MS ? parseInt(config.BALANCE_RETRY_DELAY_MS) : 2000;
        
        const purchasedAmount = await waitForBalanceChange(connection, wallet, tokenMint, retryCount, retryDelay);
        console.log(`Purchased ${purchasedAmount} tokens of ${tokenMint}`);
        
        // 3. Wait for sell delay
        const sellDelaySeconds = config.SELL_DELAY_SECONDS ? parseInt(config.SELL_DELAY_SECONDS) : 60;
        console.log(`Waiting ${sellDelaySeconds} seconds before selling...`);
        await delay(sellDelaySeconds * 1000);
        
        // 4. Sell all tokens and close account (with retry)
        console.log(`Initiating safe sell and close for ${tokenMint}...`);

        try {
            const sellTx = await withRetry(
                () => safeSellAndClose(connection, tokenMint, wallet, isNewToken),
                'TokenSell',
                5,
                1000,
                true
            );
            console.log("Sell and close transaction successful:", sellTx);
        } catch (error) {
            console.error("Failed to sell and close after all retries:", error);
            throw error;
        }
        
    } catch (error) {
        console.error("Error in buy and sell flow:", error instanceof Error ? error.message : JSON.stringify(error));
        throw error;
    }
}

/**
 * Check token availability and buy if available
 * @param newTokenMint Token mint address to check and buy
 */
export async function checkAndBuy(newTokenMint: string) {
    try {
        console.log(`Checking availability for token ${newTokenMint}...`);
        const isAvailable = await checkTokenAvailability(newTokenMint);
        
        if (isAvailable) {
            console.log(`Token ${newTokenMint} is available. Starting buy flow...`);
            await buyAndSellFlow(newTokenMint, undefined);
        } else {
            console.log(`Token ${newTokenMint} is not available for trading yet. Skipping.`);
        }
    } catch (error) {
        console.error("Error in check and buy:", error instanceof Error ? error.message : JSON.stringify(error));
    }
} 