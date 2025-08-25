// HYPE wrapping functionality for HyperEVM (Chain ID: 999)

// Wrapped HYPE contract address on HyperEVM
const WHYPE_CONTRACT_ADDRESS = "0x5555555555555555555555555555555555555555";

// HYPE token address (native token) on HyperEVM
const HYPE_TOKEN_ADDRESS = "0x2222222222222222222222222222222222222222";

// HyperEVM chain configuration
const HYPEREVM_CHAIN_ID = 999;
const HYPEREVM_RPC_URL = "https://rpc.hyperliquid.xyz/evm";

// Wrapped HYPE ABI (deposit and withdraw functions)
const whypeAbi = [
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

// Wrap HYPE to WHYPE on HyperEVM
export const wrapHype = async (
  inputAmount: string,
  signer: any // ethers signer from user's wallet
) => {
  try {
    const { ethers } = await import('ethers');
    
    // Ensure we're on HyperEVM chain
    const network = await signer.provider.getNetwork();
    if (network.chainId !== BigInt(HYPEREVM_CHAIN_ID)) {
      throw new Error(`Wrong network! Expected HyperEVM (Chain ID: ${HYPEREVM_CHAIN_ID}), got Chain ID: ${network.chainId}`);
    }
    
    // Parse the input amount to wei (HYPE has 18 decimals)
    const amountInWei = ethers.parseEther(inputAmount);
    
    // Create contract with signer for writing
    const whypeContract = new ethers.Contract(WHYPE_CONTRACT_ADDRESS, whypeAbi, signer);
    
    // Call deposit function with HYPE amount as value
    const tx = await whypeContract.deposit({
      value: amountInWei
    });
    
    // Return transaction for user to confirm
    return tx;
  } catch (err) {
    console.error("Error wrapping HYPE on HyperEVM:", err);
    throw err;
  }
};

// Unwrap WHYPE to HYPE on HyperEVM
export const unwrapHype = async (
  inputAmount: string,
  signer: any // ethers signer from user's wallet
) => {
  try {
    const { ethers } = await import('ethers');
    
    // Ensure we're on HyperEVM chain
    const network = await signer.provider.getNetwork();
    if (network.chainId !== BigInt(HYPEREVM_CHAIN_ID)) {
      throw new Error(`Wrong network! Expected HyperEVM (Chain ID: ${HYPEREVM_CHAIN_ID}), got Chain ID: ${network.chainId}`);
    }
    
    // Parse the input amount to wei (WHYPE has 18 decimals)
    const amountInWei = ethers.parseEther(inputAmount);
    
    // Create contract with signer for writing
    const whypeContract = new ethers.Contract(WHYPE_CONTRACT_ADDRESS, whypeAbi, signer);
    
    // Call withdraw function
    const tx = await whypeContract.withdraw(amountInWei);
    
    // Return transaction for user to confirm
    return tx;
  } catch (err) {
    console.error("Error unwrapping HYPE on HyperEVM:", err);
    throw err;
  }
};

// Get WHYPE balance on HyperEVM
export const getWhypeBalance = async (
  userAddress: string,
  provider: any // ethers provider
) => {
  try {
    const { ethers } = await import('ethers');
    
    // Ensure we're on HyperEVM chain
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(HYPEREVM_CHAIN_ID)) {
      throw new Error(`Wrong network! Expected HyperEVM (Chain ID: ${HYPEREVM_CHAIN_ID}), got Chain ID: ${network.chainId}`);
    }
    
    // Create contract with provider for reading
    const whypeContract = new ethers.Contract(WHYPE_CONTRACT_ADDRESS, whypeAbi, provider);
    
    // Get balance
    const balance = await whypeContract.balanceOf(userAddress);
    
    // Convert to human readable format (18 decimals)
    return ethers.formatEther(balance);
  } catch (err) {
    console.error("Error getting WHYPE balance on HyperEVM:", err);
    return "0";
  }
};

export { WHYPE_CONTRACT_ADDRESS, HYPE_TOKEN_ADDRESS };
