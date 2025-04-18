/**
 * Configuration Utilities
 * 
 * This module manages environment configuration and provides utility functions
 * for wallet management and token conversions.
 */

import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import dotenv from "dotenv";

// Solana constants
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const SOL_DECIMALS = 9; // SOL has 9 decimals

// Environment configuration interface
export interface EnvConfig {
    PRIVATE_KEY: string;
    BUY_AMOUNT_SOL: string;
    SLIPPAGE_BPS: string;
    RPC_ENDPOINT: string;
    PRIORITY_FEE_LAMPORTS?: string;
    PRIORITY_LEVEL?: 'low' | 'medium' | 'high' | 'veryHigh';
    COMPUTE_UNIT_LIMIT?: string;
    COMPUTE_UNIT_PRICE_MICROLAMPORTS?: string;
    SELL_DELAY_SECONDS?: string;
    BALANCE_RETRY_COUNT?: string;
    BALANCE_RETRY_DELAY_MS?: string;
    MAX_RETRY_DURATION_MS?: string;
    RETRY_DELAY_MS?: string;
    NEW_TOKEN_MODE?: string;
    BASE_SLIPPAGE_BPS: number;
    NEW_TOKEN_SLIPPAGE_MULTIPLIER: number;
    MAX_SLIPPAGE_BPS: number;
    MIN_SLIPPAGE_BPS: number;
}

/**
 * Get wallet from private key in environment
 * @returns Anchor wallet instance
 */
export function getWallet(): Wallet {
    if (!process.env.PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY is not set in .env");
    }
    return new Wallet(
        Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY))
    );
}

/**
 * Convert human-readable amount to lamports
 * @param amount Amount in SOL or token units
 * @param decimals Token decimals (default: SOL_DECIMALS)
 * @returns Amount in lamports
 */
export function toLamports(amount: number, decimals: number = SOL_DECIMALS): number {
    return Math.round(amount * Math.pow(10, decimals));
}

/**
 * Get configuration from environment variables
 * @returns Environment configuration object
 */
export function getConfig(): EnvConfig {
    return {
        PRIVATE_KEY: process.env.PRIVATE_KEY || "",
        BUY_AMOUNT_SOL: process.env.BUY_AMOUNT_SOL || "",
        SLIPPAGE_BPS: process.env.SLIPPAGE_BPS || "100",
        RPC_ENDPOINT: process.env.RPC_ENDPOINT || "https://api.mainnet-beta.solana.com",
        PRIORITY_FEE_LAMPORTS: process.env.PRIORITY_FEE_LAMPORTS,
        PRIORITY_LEVEL: process.env.PRIORITY_LEVEL as 'low' | 'medium' | 'high' | 'veryHigh' | undefined,
        COMPUTE_UNIT_LIMIT: process.env.COMPUTE_UNIT_LIMIT,
        COMPUTE_UNIT_PRICE_MICROLAMPORTS: process.env.COMPUTE_UNIT_PRICE_MICROLAMPORTS,
        SELL_DELAY_SECONDS: process.env.SELL_DELAY_SECONDS,
        BALANCE_RETRY_COUNT: process.env.BALANCE_RETRY_COUNT,
        BALANCE_RETRY_DELAY_MS: process.env.BALANCE_RETRY_DELAY_MS,
        MAX_RETRY_DURATION_MS: process.env.MAX_RETRY_DURATION_MS,
        RETRY_DELAY_MS: process.env.RETRY_DELAY_MS,
        NEW_TOKEN_MODE: process.env.NEW_TOKEN_MODE || "false", // Default to false
        BASE_SLIPPAGE_BPS: parseInt(process.env.BASE_SLIPPAGE_BPS || "200"),
        NEW_TOKEN_SLIPPAGE_MULTIPLIER: parseInt(process.env.NEW_TOKEN_SLIPPAGE_MULTIPLIER || "5"),
        MAX_SLIPPAGE_BPS: parseInt(process.env.MAX_SLIPPAGE_BPS || "5000"),
        MIN_SLIPPAGE_BPS: parseInt(process.env.MIN_SLIPPAGE_BPS || "1000")
    };
} 