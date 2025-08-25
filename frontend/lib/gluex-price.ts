interface GlueXPricePayload {
  chainID: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  userAddress: string;
  outputReceiver: string;
  uniquePID: string;
  activateSurplusFee: boolean;
  partnerAddress: string;
}

interface GlueXPriceResponse {
  statusCode: number;
  result: {
    effectiveInputAmountUSD: number;
    effectiveOutputAmountUSD: number;
    expectedOutputAmount: string;
    priceImpact: number;
    // Add other fields as needed
  };
}

class GlueXPriceClient {
  private apiKey: string;
  private baseUrl: string;
  private chainId: string;
  private uniquePid: string;
  private partnerAddress: string;

  constructor() {
    this.apiKey = ''; // Not needed for internal API calls
    this.baseUrl = '/api'; // Use internal Next.js API
    this.chainId = 'hyperevm'; // Arbitrum
    this.uniquePid = process.env.NEXT_PUBLIC_GLUEX_PID || '';
    this.partnerAddress = process.env.NEXT_PUBLIC_GLUEX_PARTNER_ADDRESS || '0xBf879877e05430aC14fcEF6fE102DF29e264b114';
  }

  private buildHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  }

  private buildPayload(
    inputToken: string,
    outputToken: string,
    inputAmount: string,
    userAddress: string,
    outputReceiver?: string
  ): GlueXPricePayload {
    return {
      chainID: this.chainId,
      inputToken,
      outputToken,
      inputAmount,
      userAddress,
      outputReceiver: outputReceiver || userAddress,
      uniquePID: this.uniquePid,
      activateSurplusFee: true,
      partnerAddress: this.partnerAddress,
    };
  }

  async getPrice(
    inputToken: string,
    outputToken: string,
    inputAmount: string,
    userAddress: string,
    outputReceiver?: string
  ): Promise<GlueXPriceResponse | null> {
    try {
      // Silent background price fetching
      const payload = this.buildPayload(
        inputToken,
        outputToken,
        inputAmount,
        userAddress,
        outputReceiver
      );

      const response = await fetch(`${this.baseUrl}/gluex-price`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      // Silent error handling - prices will be retried in 5 seconds
      return null;
    }
  }
}

export const glueXPriceClient = new GlueXPriceClient();

// Utility function to get token decimals (you might want to expand this based on your token list)
export const getTokenDecimals = (tokenAddress: string): number => {
  // Most ERC20 tokens use 18 decimals, but you can add specific cases here
  const decimalsMap: { [key: string]: number } = {
    // Add specific token decimals if needed
    // '0x...': 6, // USDC example
  };
  
  return decimalsMap[tokenAddress.toLowerCase()] || 18;
};

// Function to convert amount to wei format
export const toWeiAmount = (amount: number, tokenAddress: string): string => {
  const decimals = getTokenDecimals(tokenAddress);
  const multiplier = Math.pow(10, decimals);
  const weiAmount = Math.floor(amount * multiplier); // Convert to integer first
  return weiAmount.toString(); // Then convert to string
};
