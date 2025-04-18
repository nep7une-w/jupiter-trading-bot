/**
 * Token Utilities
 * 
 * This module provides functions for working with tokens on Solana.
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { delay } from "./helpers";
import { SOL_DECIMALS, SOL_MINT } from "./config";

/**
 * Get token decimals from on-chain data
 * @param connection Solana connection
 * @param tokenMint Token mint address
 * @returns Number of decimals for the token
 */
export async function getTokenDecimals(connection: Connection, tokenMint: PublicKey): Promise<number> {
    // Special case for SOL
    if (tokenMint.toBase58() === SOL_MINT) {
        return SOL_DECIMALS;
    }

    try {
        const mintInfo = await connection.getParsedAccountInfo(tokenMint);
        
        if (mintInfo.value) {
            const parsedData = (mintInfo.value.data as any)?.parsed;
            if (parsedData?.info?.decimals) {
                return parsedData.info.decimals;
            }
        }
        throw new Error("Could not parse mint info");
    } catch (error) {
        console.error(`Error getting token decimals: ${error instanceof Error ? error.message : error}`);
        return 9; // Default to 9 decimals (like SOL) if we can't fetch the actual value
    }
}

/**
 * Get token balance for a wallet
 * @param connection Solana connection
 * @param wallet Wallet to check balance for
 * @param tokenMint Token mint address
 * @returns Token balance (in token units, not lamports)
 */
export async function getTokenBalance(
    connection: Connection,
    wallet: Wallet,
    tokenMint: string
): Promise<number> {
    try {
        // Special case for SOL
        if (tokenMint === SOL_MINT) {
            const solBalance = await connection.getBalance(wallet.publicKey);
            return solBalance / Math.pow(10, SOL_DECIMALS);
        }
        
        // For SPL tokens, get associated token account
        const mint = new PublicKey(tokenMint);
        const tokenAccount = await getAssociatedTokenAddress(
            mint,
            wallet.publicKey
        );
        
        try {
            const balance = await connection.getTokenAccountBalance(tokenAccount);
            return parseFloat(balance.value.uiAmount?.toString() || "0");
        } catch (error) {
            // If token account doesn't exist, balance is 0
            if ((error as any)?.message?.includes("could not find account")) {
                return 0;
            }
            throw error;
        }
    } catch (error) {
        console.error(`Error getting token balance: ${error instanceof Error ? error.message : error}`);
        return 0;
    }
}

/**
 * Wait for a token balance to change
 * @param connection Solana connection
 * @param wallet Wallet to check balance for
 * @param tokenMint Token mint address
 * @param retries Number of retries before giving up
 * @param delayMs Delay between retries (ms)
 * @returns New token balance
 */
export async function waitForBalanceChange(
    connection: Connection,
    wallet: Wallet,
    tokenMint: string,
    retries: number = 5,
    delayMs: number = 2000
): Promise<number> {
    // Get initial balance
    let initialBalance = await getTokenBalance(connection, wallet, tokenMint);
    let currentBalance = initialBalance;
    let attempts = 0;
    
    console.log(`Initial ${tokenMint} balance: ${initialBalance}`);
    
    // Keep checking until we see a change or run out of retries
    while (attempts < retries && currentBalance === initialBalance) {
        console.log(`Waiting for balance change (attempt ${attempts + 1}/${retries})...`);
        await delay(delayMs);
        
        currentBalance = await getTokenBalance(connection, wallet, tokenMint);
        console.log(`Current balance: ${currentBalance}`);
        attempts++;
    }
    
    if (currentBalance === initialBalance && currentBalance === 0) {
        console.warn(`No balance change detected after ${retries} attempts. Token purchase may have failed.`);
    } else if (currentBalance > initialBalance) {
        console.log(`Balance increased by ${currentBalance - initialBalance} tokens`);
    }
    
    return currentBalance;
} 