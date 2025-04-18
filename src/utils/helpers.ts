/**
 * Helper Functions
 * 
 * This module provides general utility functions used throughout the application.
 */

/**
 * Create a delay using Promises
 * @param ms Delay in milliseconds
 * @returns Promise that resolves after the specified delay
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
} 