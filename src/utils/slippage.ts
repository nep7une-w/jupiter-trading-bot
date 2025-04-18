/**
 * Slippage Calculation Utilities
 * 
 * This module provides functions for calculating appropriate slippage values
 * based on configuration and token characteristics.
 */

import { getConfig } from './config';

/**
 * Calculate slippage basis points based on configuration
 * 
 * @param isNewToken Whether the token is considered "new" requiring higher slippage
 * @returns Slippage in basis points (1 bps = 0.01%)
 */
export function calculateSlippage(isNewToken: boolean = false): number {
    const config = getConfig();
    
    // Use standard slippage for regular tokens
    if (!isNewToken) {
        return parseInt(config.SLIPPAGE_BPS || "100");
    }
    
    // For new tokens, apply the multiplier to base slippage
    const baseSlippage = config.BASE_SLIPPAGE_BPS;
    let calculatedSlippage = baseSlippage * config.NEW_TOKEN_SLIPPAGE_MULTIPLIER;
    
    // Ensure slippage is within allowed range
    calculatedSlippage = Math.min(calculatedSlippage, config.MAX_SLIPPAGE_BPS);
    calculatedSlippage = Math.max(calculatedSlippage, config.MIN_SLIPPAGE_BPS);
    
    return calculatedSlippage;
} 