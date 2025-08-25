// Dynamic import of ethers to avoid build issues for HyperEVM (Chain ID: 999)

// Default contract address on HyperEVM (if env variable not set)
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 
  "0x07389a7F85B8F5d9a509ef4f607eFd41FEc8b129";


const HYPEREVM_CHAIN_ID = 999;
const HYPEREVM_RPC_URL = "https://rpc.hyperliquid.xyz/evm";

const erc20Abi = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];


const getProvider = async () => {
  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ETH_RPC_URL || HYPEREVM_RPC_URL);
  
  // Verify we're connecting to HyperEVM
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(HYPEREVM_CHAIN_ID)) {
    throw new Error(`Wrong network! Expected HyperEVM (Chain ID: ${HYPEREVM_CHAIN_ID}), got Chain ID: ${network.chainId}`);
  }
  
  return provider;
};

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

// Approve token spending on HyperEVM
export const approveToken = async (
  tokenAddress: string,
  inputAmount: string,
  signer: any 
) => {
  try {
    const { ethers } = await import('ethers');
    
    // Ensure we're on HyperEVM chain
    const network = await signer.provider.getNetwork();
    if (network.chainId !== BigInt(HYPEREVM_CHAIN_ID)) {
      throw new Error(`Wrong network! Expected HyperEVM (Chain ID: ${HYPEREVM_CHAIN_ID}), got Chain ID: ${network.chainId}`);
    }
    
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
    console.error("Error approving token on HyperEVM:", err);
    throw err;
  }
};
