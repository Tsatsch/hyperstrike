// Dynamic import of ethers to avoid build issues

// Default contract address (if env variable not set)
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 
  "0x3BdAEE359F1F721B3Ff9f4484253C4fF35AD1040";

// Minimal ERC20 ABI (allowance, approve, and decimals functions)
const erc20Abi = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

// Provider function to get ethers provider dynamically
const getProvider = async () => {
  const { ethers } = await import('ethers');
  return new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://rpc.hyperliquid.xyz/evm");
};

// Check allowance
export const checkAllowance = async (
  tokenAddress: string,
  ownerAddress: string,
) => {
  try {
    const { ethers } = await import('ethers');
    const provider = await getProvider();
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const allowance = await tokenContract.allowance(ownerAddress, contractAddress);
    return allowance; // BigInt
  } catch (err) {
    console.error("Error checking allowance:", err);
    return null;
  }
};

// Get token decimals
export const getTokenDecimals = async (tokenAddress: string) => {
  try {
    const { ethers } = await import('ethers');
    const provider = await getProvider();
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
    const decimals = await tokenContract.decimals();
    return Number(decimals);
  } catch (err) {
    console.error("Error getting token decimals:", err);
    return 18; // Default to 18 decimals if error
  }
};

// Approve token spending
export const approveToken = async (
  tokenAddress: string,
  inputAmount: string,
  signer: any // ethers signer from user's wallet
) => {
  try {
    const { ethers } = await import('ethers');
    
    // Get token decimals
    const decimals = await getTokenDecimals(tokenAddress);
    
    // Format the input amount to prevent precision issues
    // Round to the token's decimal places to avoid "too many decimals" error
    const formattedAmount = parseFloat(inputAmount).toFixed(decimals);
    
    // Calculate approval amount: inputAmount * 10^decimals
    const amountWithDecimals = ethers.parseUnits(formattedAmount, decimals);
    
    // Create contract with signer for writing
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);
    
    // Call approve function
    const tx = await tokenContract.approve(contractAddress, amountWithDecimals);
    
    // Return transaction for user to confirm
    return tx;
  } catch (err) {
    console.error("Error approving token:", err);
    throw err;
  }
};
