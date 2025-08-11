/**
 * Generate a consistent user ID from a wallet address
 * This creates a deterministic hash that will always be the same for the same wallet
 */
export function getUserIdFromWallet(walletAddress: string): number {
  return Math.abs(walletAddress.split('').reduce((hash, char) => {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    return hash & hash; // Convert to 32-bit integer
  }, 0));
}

/**
 * Shorten a wallet address for display purposes
 */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Validate if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}