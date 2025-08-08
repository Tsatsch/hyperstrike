import { createPublicClient, http, formatUnits, Address, parseAbi } from 'viem'
import { defineChain } from 'viem'

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
        http: ['https://rpc.hyperliquid.xyz/evm'],
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
  transport: http(process.env.NEXT_PUBLIC_ETH_RPC_URL),
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
    console.log('🔧 fetchTokenBalances called with:', { walletAddress, tokenAddresses })
    console.log('🔧 RPC URL:', process.env.NEXT_PUBLIC_ETH_RPC_URL)
    console.log('🔧 Client chain:', client.chain)
    console.log('🔧 Client transport:', client.transport)
    
    if (!walletAddress || !tokenAddresses.length) {
      console.log('❌ Missing wallet address or token addresses')
      return {}
    }

    // First, test a simple call to see if the RPC is working
    console.log('🔧 Testing RPC connection...')
    try {
      const blockNumber = await client.getBlockNumber()
      console.log('✅ RPC working, latest block:', blockNumber)
    } catch (rpcError) {
      console.error('❌ RPC connection failed:', rpcError)
      return {}
    }

    // Prepare multicall contracts for balanceOf calls
    const balanceContracts = tokenAddresses.map((tokenAddress, index) => {
      console.log(`🔧 Preparing balance contract ${index + 1}:`, { tokenAddress, walletAddress })
      return {
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddress as Address],
      } as const
    })
    // Prepare multicall contracts for decimals calls
    const decimalsContracts = tokenAddresses.map((tokenAddress, index) => {
      console.log(`🔧 Preparing decimals contract ${index + 1}:`, { tokenAddress })
      return {
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'decimals',
        args: [],
      } as const
    })

    console.log('🔧 Prepared contracts:', { balanceContracts: balanceContracts.length, decimalsContracts: decimalsContracts.length })
    console.log('🔧 Balance contracts:', balanceContracts)
    console.log('🔧 Decimals contracts:', decimalsContracts)

    // Execute multicalls using client.multicall()
    //console.log('🔧 Executing balance multicall...')
    let balanceResults, decimalsResults
    
    try {
      balanceResults = await client.multicall({ contracts: balanceContracts, allowFailure: true })
      //console.log('✅ Balance multicall completed:', balanceResults)
    } catch (balanceError) {
      //console.error('❌ Balance multicall failed:', balanceError)
      return {}
    }

    //console.log('🔧 Executing decimals multicall...')
    try {
      decimalsResults = await client.multicall({ contracts: decimalsContracts, allowFailure: true })
      //console.log('✅ Decimals multicall completed:', decimalsResults)
    } catch (decimalsError) {
      //console.error('❌ Decimals multicall failed:', decimalsError)
      return {}
    }
    
    //console.log('🔧 All multicall results:', { balanceResults, decimalsResults })

    // Process results
    const balances: Record<string, string> = {}

    //console.log('🔧 Processing results for', tokenAddresses.length, 'tokens')

    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddress = tokenAddresses[i]
      const balanceResult = balanceResults[i]
      const decimalsResult = decimalsResults[i]

        // console.log(`🔧 Processing token ${i + 1}/${tokenAddresses.length}: ${tokenAddress}`)
        // console.log(`🔧 Balance result:`, balanceResult)
        // console.log(`🔧 Decimals result:`, decimalsResult)

      if (
        balanceResult.status === 'success' &&
        decimalsResult.status === 'success' &&
        typeof balanceResult.result === 'bigint' &&
        typeof decimalsResult.result === 'number'
      ) {
        const rawBalance = balanceResult.result
        const decimals = decimalsResult.result
        const formattedBalance = formatUnits(rawBalance, decimals)
        
        //console.log(`✅ Token ${tokenAddress}: Raw=${rawBalance}, Decimals=${decimals}, Formatted=${formattedBalance}`)
        // Store formatted balance
        balances[tokenAddress] = formattedBalance
      } else {
        //console.log(`❌ Failed to fetch balance for token ${tokenAddress}`)
        //console.log(`   Balance status: ${balanceResult.status}`)
        //console.log(`   Decimals status: ${decimalsResult.status}`)
        if (balanceResult.status === 'failure') {
        //console.log(`   Balance error:`, balanceResult.error)
        }
        if (decimalsResult.status === 'failure') {
        //console.log(`   Decimals error:`, decimalsResult.error)
        }
        balances[tokenAddress] = '0'
      }
    }

    //console.log('🔧 Final balances:', balances)
    return balances
  } catch (error) {
    //console.error('❌ Error fetching token balances:', error)
    return {}
  }
}

// Helper function to get HYPE balance
export async function fetchHYPEBalance(walletAddress: string): Promise<string> {
  try {
    //console.log('🔧 fetchETHBalance called with:', walletAddress)
    if (!walletAddress) return '0'

    const balance = await client.getBalance({
      address: walletAddress as Address,
    })

    console.log('🔧 HYPE balance raw:', balance)
    const formattedBalance = formatUnits(balance, 18) // HYPE has 18 decimals
    //console.log('🔧 HYPE balance formatted:', formattedBalance)
    return formattedBalance
  } catch (error) {
    //console.error('❌ Error fetching HYPE balance:', error)
    return '0'
  }
}