/**
 * Transaction Sender
 * 
 * This module provides functions for sending and confirming Solana transactions.
 */

import { Connection, VersionedTransactionResponse } from "@solana/web3.js";
import { wait } from "./wait";

/**
 * Interface representing a blockhash with its expiry block height
 */
interface BlockhashWithExpiryBlockHeight {
    blockhash: string;
    lastValidBlockHeight: number;
}

/**
 * Interface for transaction sender parameters
 */
interface TransactionSenderAndConfirmationWaiterParams {
    connection: Connection;
    serializedTransaction: Buffer;
    blockhashWithExpiryBlockHeight: BlockhashWithExpiryBlockHeight;
    timeoutIn?: number; // milliseconds
}

/**
 * Send a transaction and wait for confirmation
 * 
 * @param params Parameters for sending and confirming transaction
 * @returns Transaction response or null if timeout occurs
 */
export async function transactionSenderAndConfirmationWaiter(
    params: TransactionSenderAndConfirmationWaiterParams
): Promise<VersionedTransactionResponse | null> {
    const {
        connection,
        serializedTransaction,
        blockhashWithExpiryBlockHeight,
        timeoutIn = 60000, // Default 60 seconds
    } = params;

    const transactionSignature = await connection.sendRawTransaction(
        serializedTransaction,
        {
            skipPreflight: true,
        }
    );

    console.log(`Transaction sent: ${transactionSignature}`);
    console.log(`Waiting for confirmation...`);

    const timeoutAt = Date.now() + timeoutIn;
    let done = false;
    let transactionResponse: VersionedTransactionResponse | null = null;

    // Keep track of the current block height
    const { blockhash, lastValidBlockHeight } = blockhashWithExpiryBlockHeight;
    let currentBlockHeight = await connection.getBlockHeight();

    while (!done && Date.now() < timeoutAt) {
        try {
            // Check if the transaction is confirmed
            transactionResponse = await connection.getTransaction(transactionSignature, {
                maxSupportedTransactionVersion: 0,
            });

            if (transactionResponse !== null) {
                console.log(`Transaction confirmed: ${transactionSignature}`);
                return transactionResponse;
            }

            // Check if we've exceeded the last valid block height
            currentBlockHeight = await connection.getBlockHeight();
            if (currentBlockHeight > lastValidBlockHeight) {
                console.log(`Transaction expired: Current block height ${currentBlockHeight} exceeds last valid height ${lastValidBlockHeight}`);
                return null;
            }

            // Wait before checking again
            await wait(2000);
        } catch (error) {
            console.log(`Error checking transaction: ${error instanceof Error ? error.message : String(error)}`);
            // Continue waiting even if there's an error checking status
            await wait(2000);
        }
    }

    if (!transactionResponse) {
        console.log(`Transaction not confirmed within timeout: ${transactionSignature}`);
    }

    return transactionResponse;
} 