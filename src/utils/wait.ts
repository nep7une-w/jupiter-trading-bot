/**
 * Wait Utility
 * 
 * This module provides a simple function for waiting a specified amount of time.
 */

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms)); 