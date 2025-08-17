import { createPublicClient, http, formatUnits, Address, parseAbi } from 'viem'
import { defineChain } from 'viem'
import { HYPERLIQUID_TOKENS, getTokenByAddress, getNativeToken } from './tokens'

// Define Hyperliquid chain
const hyperEvm = defineChain({
    id: 999,
    name: 'HyperEVM',
    nativeCurrency: {
      decimals: 18,
      name: 'Hyperliquid', 
      symbol: 'HYPE',
    },
    rpcUrls: {
      default: {
        http: [process.env.NEXT_PUBLIC_ETH_RPC_URL || 'https://rpc.hyperliquid.xyz/evm']
      },
    },
    blockExplorers: {
      default: {
        name: 'HyperEVM Explorer',
        url: 'https://hyperevmscan.io',
        apiUrl: 'https://api.hyperevmscan.io/api',
      },
    },
    testnet: false,
    contracts: {
      multicall3: {
        address: '0xcA11bde05977b3631167028862bE2a173976CA11' as const,
        blockCreated: 13051,
      },
    },
});

// ERC20 ABI using parseAbi
const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) external view returns (uint256 balance)',
  'function decimals() external view returns (uint8)',
])

// Create public client using environment variable
const client = createPublicClient({
  chain: hyperEvm,
  transport: http(process.env.NEXT_PUBLIC_ETH_RPC_URL || 'https://rpc.hyperliquid.xyz/evm'),
})

export interface TokenBalance {
  address: string
  balance: string
  decimals: number
}

export async function fetchTokenBalances(
  walletAddress: string,
  tokenAddresses: string[]
): Promise<Record<string, string>> {
  try {
    if (!walletAddress || !tokenAddresses.length) {
      return {}
    }

    // Validate addresses and get token configs
    const validTokens = tokenAddresses
      .filter(address => address && address.startsWith('0x') && address.length === 42)
      .map(address => ({
        address,
        config: getTokenByAddress(address)
      }))

    if (validTokens.length === 0) {
      return {}
    }

    // Test RPC connection
    try {
      await client.getBlockNumber()
    } catch (rpcError) {
      console.error('RPC connection failed:', rpcError)
      return {}
    }

    // Prepare multicall for balances
    const balanceContracts = validTokens.map(({ address }) => ({
      address: address as Address,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as Address],
    } as const))

    // Execute balance multicall
    const balanceResults = await client.multicall({ 
      contracts: balanceContracts, 
      allowFailure: true 
    })

    // Process results with known decimals from config
    const balances: Record<string, string> = {}

    for (let i = 0; i < validTokens.length; i++) {
      const { address, config } = validTokens[i]
      const balanceResult = balanceResults[i]

      if (balanceResult.status === 'success' && typeof balanceResult.result === 'bigint') {
        const decimals = config?.decimals ?? 18 // fallback to 18 decimals
        const formattedBalance = formatUnits(balanceResult.result, decimals)
        
        balances[address] = formattedBalance
      } else {
        balances[address] = '0'
      }
    }

    return balances
  } catch (error) {
    console.error('Error fetching token balances:', error)
    return {}
  }
}

// Helper function to get HYPE balance
export async function fetchHYPEBalance(walletAddress: string): Promise<string> {
  try {
    if (!walletAddress) return '0'

    const balance = await client.getBalance({
      address: walletAddress as Address,
    })

    const formattedBalance = formatUnits(balance, 18) // HYPE has 18 decimals
    return formattedBalance
  } catch (error) {
    console.error('Error fetching HYPE balance:', error)
    return '0'
  }
}

// Convenience function to fetch all supported token balances
export async function fetchAllTokenBalances(walletAddress: string): Promise<Record<string, string>> {
  const nativeToken = getNativeToken()
  const erc20Tokens = HYPERLIQUID_TOKENS.filter(token => !token.isNative)
  
  const [erc20Balances, nativeBalance] = await Promise.all([
    fetchTokenBalances(walletAddress, erc20Tokens.map(token => token.address)),
    fetchHYPEBalance(walletAddress)
  ])

  return {
    ...erc20Balances,
    [nativeToken.address]: nativeBalance
  }
}