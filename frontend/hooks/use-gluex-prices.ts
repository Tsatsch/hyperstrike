import { useState, useEffect, useRef } from 'react';
import { glueXPriceClient, toWeiAmount } from '@/lib/gluex-price';

interface Token {
  symbol: string;
  address?: string;
}

interface PriceData {
  inputToken: string;
  outputToken: string;
  effectiveInputAmountUSD: number;
  effectiveOutputAmountUSD: number;
  expectedOutputAmount: string;
  priceImpact: number;
  timestamp: number;
}

interface UseGlueXPricesParams {
  fromToken: Token | null;
  toTokens: Token[];
  fromAmount: string;
  userAddress: string | undefined;
  isEnabled: boolean; // Whether to start polling
}

export const useGlueXPrices = ({
  fromToken,
  toTokens,
  fromAmount,
  userAddress,
  isEnabled
}: UseGlueXPricesParams): void => {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchPrices = async () => {
    if (!fromToken?.address || !userAddress || toTokens.length === 0 || !fromAmount || parseFloat(fromAmount) <= 0) {
      return;
    }

    setIsLoading(true);
    const newPrices: Record<string, PriceData> = {};
    const newErrors: Record<string, string> = {};

    try {
      // Convert input amount to wei
      const inputAmountWei = toWeiAmount(parseFloat(fromAmount), fromToken.address);

      // Create concurrent price requests for all output tokens
      const pricePromises = toTokens.map(async (outputToken) => {
        if (!outputToken.address) {
          return { outputToken: outputToken.symbol, error: 'No token address' };
        }

        try {
          const priceResponse = await glueXPriceClient.getPrice(
            fromToken.address!,
            outputToken.address,
            inputAmountWei,
            userAddress
          );

          if (priceResponse && priceResponse.statusCode === 200) {
            return {
              outputToken: outputToken.symbol,
              data: {
                inputToken: fromToken.symbol,
                outputToken: outputToken.symbol,
                effectiveInputAmountUSD: priceResponse.result.effectiveInputAmountUSD,
                effectiveOutputAmountUSD: priceResponse.result.effectiveOutputAmountUSD,
                expectedOutputAmount: priceResponse.result.expectedOutputAmount,
                priceImpact: priceResponse.result.priceImpact,
                timestamp: Date.now()
              } as PriceData
            };
          } else {
            return { 
              outputToken: outputToken.symbol, 
              error: `Failed to fetch price: ${priceResponse?.statusCode || 'Unknown error'}` 
            };
          }
        } catch (error) {
          return { 
            outputToken: outputToken.symbol, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      // Wait for all price requests to complete
      const results = await Promise.allSettled(pricePromises);

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          const { outputToken, data, error } = result.value;
          
          if (data) {
            newPrices[outputToken] = data;
            // Clear any previous error for this token
            delete newErrors[outputToken];
          } else if (error) {
            newErrors[outputToken] = error;
          }
        } else if (result.status === 'rejected') {
          console.error('Price request rejected:', result.reason);
        }
      });

      // Only update state if component is still mounted
      if (mountedRef.current) {
        setPrices(newPrices);
        setErrors(newErrors);
        setLastUpdated(Date.now());
      }
    } catch (error) {
      console.error('Error fetching prices:', error);
      if (mountedRef.current) {
        setErrors({ general: error instanceof Error ? error.message : 'Unknown error' });
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Start/stop polling based on isEnabled
  useEffect(() => {
    if (!isEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fetch prices immediately
    fetchPrices();

    // Set up polling every 10 seconds
    intervalRef.current = setInterval(fetchPrices, 10000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fromToken?.address, toTokens, fromAmount, userAddress, isEnabled]);

  // Additional effect to fetch prices immediately when output tokens change
  useEffect(() => {
    if (isEnabled && toTokens.length > 0 && fromToken?.address && userAddress && fromAmount && parseFloat(fromAmount) > 0) {
      // Debounce rapid token changes by using a small timeout
      const timeoutId = setTimeout(() => {
        fetchPrices();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [JSON.stringify(toTokens.map(t => ({ symbol: t.symbol, address: t.address })))]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // No return needed - this hook runs silently in the background
};
