/**
 * Swap Utilities
 * 
 * This module provides functions for performing token swaps using Jupiter.
 */

import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import { QuoteResponse, SwapRequest, SwapResponse } from '@jup-ag/api';
import { 
    getAssociatedTokenAddress, 
    createCloseAccountInstruction, 
    TOKEN_PROGRAM_ID 
} from "@solana/spl-token";

import { getConfig, SOL_MINT } from "./config";
import { jupiterQuoteApi } from "./api";
import { transactionSenderAndConfirmationWaiter } from "./transactionSender";
import { getSignature } from "./getSignature";
import { getTokenBalance, getTokenDecimals } from "./tokens";
import { calculateSlippage } from "./slippage";
import { delay } from "./helpers";

/**
 * Execute a swap transaction
 * @param connection Solana connection
 * @param swapResponse Swap response from Jupiter API
 * @param wallet Wallet to use for the transaction
 * @returns Transaction signature
 */
export async function executeSwap(
    connection: Connection,
    swapResponse: SwapResponse,
    wallet: Wallet
): Promise<string> {
    // Deserialize the transaction
    const swapTransactionBuf = new Uint8Array(
        Buffer.from(swapResponse.swapTransaction, "base64")
    );
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // Sign the transaction
    transaction.sign([wallet.payer]);
    const signature = getSignature(transaction);

    // First simulate the transaction
    const { value: simulatedTransactionResponse } = await connection.simulateTransaction(transaction, {
        replaceRecentBlockhash: true,
        commitment: "processed",
    });

    // Check simulation results
    if (simulatedTransactionResponse.err) {
        console.error("Simulation Error:", simulatedTransactionResponse.err);
        console.error("Simulation Logs:", simulatedTransactionResponse.logs);
        throw new Error("Transaction simulation failed");
    }

    // Serialize the transaction for sending
    const serializedTransaction = Buffer.from(transaction.serialize());
    const blockhash = transaction.message.recentBlockhash;

    // Send and wait for confirmation
    const transactionResponse = await transactionSenderAndConfirmationWaiter({
        connection,
        serializedTransaction,
        blockhashWithExpiryBlockHeight: {
            blockhash,
            lastValidBlockHeight: swapResponse.lastValidBlockHeight,
        },
    });

    // Check transaction results
    if (!transactionResponse) {
        throw new Error("Transaction not confirmed");
    }

    if (transactionResponse.meta?.err) {
        console.error(transactionResponse.meta?.err);
        throw new Error("Transaction failed");
    }

    return signature;
}

/**
 * Get swap response from Jupiter API
 * @param wallet Wallet for the transaction
 * @param quote Quote from Jupiter API
 * @param options Additional options for the swap
 * @returns Swap response from Jupiter API
 */
export async function getSwapResponse(
    wallet: Wallet, 
    quote: QuoteResponse,
    options?: {
        isSell?: boolean;
        isNewToken?: boolean;
    }
): Promise<SwapResponse> {
    const config = getConfig();
    const isNewToken = options?.isNewToken ?? config.NEW_TOKEN_MODE === "true";
    const priorityFeeLamports = config.PRIORITY_FEE_LAMPORTS 
        ? parseInt(config.PRIORITY_FEE_LAMPORTS)
        : 10000000; // Default value

    const priorityLevel = config.PRIORITY_LEVEL || 'veryHigh';
    const slippageBps = calculateSlippage(isNewToken);
    
    // Create base swap request with required fields
    const swapRequest: SwapRequest = {
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toBase58(),
        dynamicComputeUnitLimit: true,
        dynamicSlippage: false,
        asLegacyTransaction: false,
        wrapAndUnwrapSol: true,
        prioritizationFeeLamports: {
            priorityLevelWithMaxLamports: {
                maxLamports: priorityFeeLamports,
                priorityLevel: priorityLevel as any, // Type assertion needed for API compatibility
            },
        },
    };

    // Add additional parameters using type assertion for API compatibility
    // NOTE: These fields may not be in the type definition but are supported by the API
    const extendedSwapRequest = swapRequest as SwapRequest & {
        computeUnitLimit?: number;
        computeUnitPriceMicroLamports?: number;
    };

    // Optional: Add compute unit configuration
    if (config.COMPUTE_UNIT_LIMIT) {
        extendedSwapRequest.computeUnitLimit = parseInt(config.COMPUTE_UNIT_LIMIT);
    }

    if (config.COMPUTE_UNIT_PRICE_MICROLAMPORTS) {
        extendedSwapRequest.computeUnitPriceMicroLamports = parseInt(config.COMPUTE_UNIT_PRICE_MICROLAMPORTS);
    }

    return await jupiterQuoteApi.swapPost({ swapRequest: extendedSwapRequest });
}

/**
 * Simulate a swap transaction
 * @param connection Solana connection
 * @param swapResponse Swap response from Jupiter API
 * @param wallet Wallet for the transaction
 */
export async function simulateSwap(
    connection: Connection,
    swapResponse: SwapResponse, 
    wallet: Wallet
): Promise<void> {
    const swapTransactionBuf = new Uint8Array(
        Buffer.from(swapResponse.swapTransaction, "base64")
    );
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    transaction.sign([wallet.payer]);
    
    const { value: simulatedResponse } = await connection.simulateTransaction(transaction, {
        replaceRecentBlockhash: true,
        commitment: "confirmed"
    });
    
    if (simulatedResponse.err) {
        console.error("Simulation Error:", simulatedResponse.err);
        console.error("Simulation Logs:", simulatedResponse.logs);
        throw new Error("Transaction simulation failed");
    }
    
    console.log("Transaction simulation successful");
}

/**
 * Execute a swap with retries and safety checks
 * @param connection Solana connection
 * @param quote Quote from Jupiter API
 * @param wallet Wallet for the transaction 
 * @param maxRetries Maximum number of retry attempts
 * @returns Transaction signature
 */
export async function executeSwapSafely(
    connection: Connection,
    quote: QuoteResponse,
    wallet: Wallet,
    maxRetries: number = 2
): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Swap attempt ${attempt}/${maxRetries}`);
            
            // 1. Get new swap response (get fresh data for each retry)
            const swapResponse = await getSwapResponse(wallet, quote);
            
            // 2. Simulate transaction
            console.log("Simulating transaction...");
            await simulateSwap(connection, swapResponse, wallet);
            
            // 3. Execute actual transaction
            console.log("Executing real transaction...");
            return await executeSwap(connection, swapResponse, wallet);
            
        } catch (error) {
            lastError = error as Error;
            console.error(`Attempt ${attempt} failed:`, error);
            
            if (attempt < maxRetries) {
                // Exponential backoff
                const delayMs = Math.min(500 * Math.pow(2, attempt), 2000);
                console.log(`Waiting ${delayMs}ms before retry...`);
                await delay(delayMs);
            }
        }
    }
    
    throw lastError || new Error("Swap failed after all retries");
}

/**
 * Sell tokens and close the token account
 * @param connection Solana connection
 * @param tokenMint Token mint address to sell
 * @param wallet Wallet for the transaction
 * @param isNewToken Whether this is a new token (for slippage calculation)
 * @returns Transaction signature
 */
export async function safeSellAndClose(
    connection: Connection,
    tokenMint: string,
    wallet: Wallet,
    isNewToken?: boolean
): Promise<string> {
    try {
        // 1. Get current token balance
        const tokenBalance = await getTokenBalance(connection, wallet, tokenMint);
        if (tokenBalance <= 0) {
            throw new Error(`No balance available for token ${tokenMint}`);
        }
        
        console.log(`Current balance of ${tokenMint}: ${tokenBalance}`);
        
        // 2. Get decimals
        const decimals = await getTokenDecimals(connection, new PublicKey(tokenMint));
        
        // 3. Get quote for selling all tokens
        const amount = Math.floor(tokenBalance * Math.pow(10, decimals));
        const isNewTokenMode = isNewToken ?? getConfig().NEW_TOKEN_MODE === "true";
        
        const params = {
            inputMint: tokenMint,
            outputMint: SOL_MINT,
            amount,
            slippageBps: calculateSlippage(isNewTokenMode),
        };
        
        console.log(`Getting quote to sell ${tokenBalance} tokens (${amount} base units)...`);
        const quote = await jupiterQuoteApi.quoteGet(params);
        
        if (!quote || !quote.outAmount) {
            throw new Error("Failed to get valid quote for selling");
        }
        
        console.log(`Quote received: Will get ${BigInt(quote.outAmount) / BigInt(10**9)} SOL for ${tokenBalance} tokens`);
        
        // 4. Execute swap with safety checks
        return await executeSwapSafely(connection, quote, wallet, 3);
        
    } catch (error) {
        console.error("Error in safeSellAndClose:", error);
        throw error;
    }
} 