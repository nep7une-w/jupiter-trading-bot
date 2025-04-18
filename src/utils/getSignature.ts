/**
 * Transaction Signature Utilities
 * 
 * This module provides functions for managing transaction signatures.
 */

import { Transaction, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Get signature from a transaction
 * @param transaction Transaction object
 * @returns Transaction signature as base58 string
 */
export function getSignature(transaction: Transaction | VersionedTransaction): string {
    if (transaction instanceof Transaction) {
        // Get signature from legacy transaction
        const signature = transaction.signatures[0].signature;
        if (!signature) {
            throw new Error("Transaction has no signature");
        }
        // Type assertion to handle Buffer vs Uint8Array compatibility
        return bs58.encode(signature as unknown as Uint8Array);
    } else {
        // Get signature from versioned transaction
        if (transaction.signatures.length === 0) {
            throw new Error("Transaction has no signatures");
        }
        // Type assertion to handle Buffer vs Uint8Array compatibility
        return bs58.encode(transaction.signatures[0] as unknown as Uint8Array);
    }
} 