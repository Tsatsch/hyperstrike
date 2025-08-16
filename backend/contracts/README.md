# PriceTriggerSwap Smart Contract

## Overview

The `PriceTriggerSwap` smart contract is designed for automated token swaps on HyperEVM using **GlueX Router** for execution. It implements an **allowance-based system** where users provide allowances for their tokens and deposit HYPE tokens for gas fees, allowing the contract to execute swaps automatically when price conditions are met.

## Key Features

### 🔐 Allowance-Based System
- **No token deposits**: Users keep their tokens in their wallets
- **ERC20 allowances**: Users approve the contract to spend specific amounts
- **Secure execution**: Contract only transfers tokens when executing swaps

### ⛽ Gas Deposit Management
- **HYPE token deposits**: Users deposit HYPE tokens for transaction fees
- **Automatic gas reservation**: Gas is reserved when creating triggers
- **Smart refunds**: Unused gas is automatically refunded after swaps
- **Withdrawal protection**: Users can't withdraw gas needed for active triggers

### 🚀 Automated Execution via GlueX Router
- **GlueX integration**: All swaps executed through GlueX Router
- **Backend control**: All price monitoring and trigger logic handled off-chain
- **Authorized execution**: Only authorized backend services can execute swaps
- **Slippage protection**: Minimum output amounts prevent unfavorable trades

## GlueX Router Integration

### Router Address
```solidity
// GlueX Router address (placeholder - replace with actual address)
address public constant GLUEX_ROUTER = 0x0000000000000000000000000000000000000000;
```

### Swap Execution Flow
1. **Token Approval**: Contract approves GlueX Router to spend input tokens
2. **Swap Data Preparation**: Formats swap parameters for GlueX Router
3. **Router Call**: Executes swap via low-level call to GlueX Router
4. **Result Parsing**: Extracts actual output amount from router response
5. **Validation**: Ensures minimum output amount requirements are met

### Swap Data Format
The contract prepares swap data in the following format:
```solidity
function _prepareGlueXSwapData(
    PriceTrigger memory trigger,
    uint256 swapAmount
) internal pure returns (bytes memory swapData)
```

**Current Implementation**: Generic ERC20 swap interface
- `swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)`
- **Note**: This is a placeholder - implement actual GlueX interface

### Response Parsing
```solidity
function _parseGlueXSwapResult(
    bytes memory result,
    uint256 minAmountOut
) internal pure returns (uint256 amountOut)
```

**Current Implementation**: Basic result parsing
- Assumes first 32 bytes contain output amount
- Falls back to minimum amount if parsing fails
- **Note**: Implement proper parsing based on GlueX response format

## How It Works

### 1. User Setup
```solidity
// User deposits HYPE tokens for gas fees
function depositGas(uint256 amount) external

// User approves tokens for the contract
// (Done via standard ERC20 approve function)
```

### 2. Create Price Trigger
```solidity
function createPriceTrigger(
    string memory triggerId,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
) external
```

**What happens:**
- Contract checks if user has sufficient HYPE gas deposit
- Reserves gas amount for this trigger
- Creates trigger record (no tokens transferred yet)
- Emits `TriggerCreated` event

### 3. Backend Monitoring
- Backend service monitors price feeds
- When conditions are met, backend calls `executeSwap()`

### 4. Swap Execution via GlueX
```solidity
function executeSwap(string memory triggerId) external onlyAuthorized
```

**What happens:**
- Contract verifies user has sufficient allowance
- Transfers tokens from user using allowance
- **Executes swap on GlueX Router** (new integration)
- Calculates actual gas used
- Refunds excess gas to user
- Transfers swapped tokens to user
- Emits `SwapExecuted` event

### 5. Gas Management
```solidity
// Withdraw unused HYPE tokens
function withdrawGas(uint256 amount) external

// Cancel trigger and get gas refund
function cancelTrigger(string memory triggerId) external
```

## Contract Architecture

### State Variables
- `priceTriggers`: Maps trigger IDs to trigger details
- `userTriggerIds`: Maps users to their trigger IDs
- `userGasDeposits`: Maps users to their HYPE token deposits
- `authorizedCallers`: Whitelist of backend services
- `estimatedGasPerSwap`: Estimated gas cost per swap
- `GLUEX_ROUTER`: GlueX Router contract address
- `GLUEX_QUOTE_ENDPOINT`: GlueX API endpoint for quotes

### Key Structs
```solidity
struct PriceTrigger {
    address user;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 minAmountOut;
    bool isActive;
    uint256 createdAt;
    uint256 gasReserved; // HYPE tokens reserved for this trigger
}
```

### Modifiers
- `onlyAuthorized`: Only authorized callers can execute swaps
- `triggerExists`: Ensures trigger exists
- `triggerActive`: Ensures trigger is active
- `sufficientAllowance`: Ensures user has approved sufficient tokens
- `sufficientGasDeposit`: Ensures user has sufficient gas deposit

## GlueX Router Implementation

### Current Placeholder Functions

#### `_prepareGlueXSwapData()`
- **Purpose**: Formats swap parameters for GlueX Router
- **Current**: Generic ERC20 swap interface
- **TODO**: Implement actual GlueX Router interface

#### `_parseGlueXSwapResult()`
- **Purpose**: Parses swap result from GlueX Router
- **Current**: Basic result parsing with fallback
- **TODO**: Implement proper GlueX response parsing

### Integration Requirements

1. **Router Interface**: Implement correct GlueX Router function calls
2. **Parameter Format**: Format swap parameters according to GlueX specifications
3. **Response Handling**: Parse GlueX Router responses correctly
4. **Error Handling**: Handle GlueX Router errors and failures
5. **Gas Optimization**: Optimize gas usage for GlueX Router calls

## User Workflow

### Step 1: Deposit Gas
1. User approves HYPE tokens for the contract
2. User calls `depositGas(amount)` to deposit HYPE tokens

### Step 2: Approve Tokens
1. User approves the contract to spend their trading tokens
2. This is done via standard ERC20 `approve()` function

### Step 3: Create Trigger
1. User calls `createPriceTrigger()` with swap parameters
2. Contract reserves gas and creates trigger record

### Step 4: Wait for Execution
1. Backend monitors prices
2. When conditions are met, backend executes swap via GlueX Router
3. User receives swapped tokens
4. Excess gas is refunded

## Security Features

### Access Control
- **Ownable**: Only owner can modify critical parameters
- **Authorized Callers**: Only whitelisted backend services can execute swaps
- **User Authorization**: Users must approve token spending

### Reentrancy Protection
- **ReentrancyGuard**: Prevents reentrancy attacks during swaps
- **Secure token transfers**: Tokens are transferred only when needed

### Emergency Functions
- **Pausable**: Contract can be paused in emergencies
- **Emergency Withdraw**: Owner can withdraw stuck tokens

## Configuration

### Required Addresses
```solidity
// Set these addresses after deployment
address public constant GLUEX_ROUTER = 0x...; // GlueX Router contract
address public constant HYPE_TOKEN = 0x...;   // HYPE token contract
```

### GlueX Configuration
```solidity
// GlueX API endpoint for quotes
string public constant GLUEX_QUOTE_ENDPOINT = "https://router.gluex.xyz/v1/quote";

// Native token representation
address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
```

### Gas Estimation
```solidity
// Adjust based on actual GlueX Router gas costs
uint256 public estimatedGasPerSwap = 0.01 ether;
```

### Protocol Fees
```solidity
// Configurable up to 5%
uint256 public protocolFee = 50; // 0.5%
uint256 public constant MAX_FEE = 500; // 5%
```

## Events

### Core Events
- `TriggerCreated`: When a new price trigger is created
- `SwapExecuted`: When a swap is successfully executed via GlueX
- `TriggerCancelled`: When a trigger is cancelled by user
- `GasDeposited`: When user deposits HYPE tokens
- `GasRefunded`: When gas is refunded to user

## Deployment Checklist

1. **Deploy contract** using `deploy.js`
2. **Set GlueX Router address** (update constant)
3. **Set HYPE token address** (update constant)
4. **Configure authorized callers** (backend services)
5. **Set gas estimation** based on actual GlueX Router costs
6. **Test GlueX integration** on testnet
7. **Implement proper GlueX interface** based on documentation

## GlueX Router Integration Checklist

### Phase 1: Basic Integration ✅
- [x] Update router address constant
- [x] Implement placeholder swap functions
- [x] Add GlueX-specific configuration

### Phase 2: Interface Implementation 🔄
- [ ] Research GlueX Router interface
- [ ] Implement correct function signatures
- [ ] Format parameters according to GlueX specs
- [ ] Handle GlueX-specific error cases

### Phase 3: Response Handling 🔄
- [ ] Implement proper response parsing
- [ ] Handle different response formats
- [ ] Add error handling for failed swaps
- [ ] Optimize gas usage

### Phase 4: Testing & Optimization 🔄
- [ ] Test on GlueX testnet
- [ ] Verify gas estimation accuracy
- [ ] Test edge cases and error scenarios
- [ ] Optimize for production use

## Gas Optimization

### Current Implementation
- Gas estimation is conservative (80% of estimated amount)
- Unused gas is automatically refunded
- Gas is reserved per trigger to prevent over-withdrawal

### GlueX-Specific Optimizations
- **Router Calls**: Optimize low-level calls to GlueX Router
- **Data Encoding**: Efficient parameter encoding for GlueX
- **Response Parsing**: Minimal gas usage for result parsing
- **Error Handling**: Efficient error handling for GlueX failures

## Integration with Backend

### Required Backend Functions
1. **Price Monitoring**: Monitor relevant price feeds
2. **Condition Checking**: Determine when triggers should execute
3. **Swap Execution**: Call `executeSwap()` when conditions are met
4. **Gas Management**: Monitor and optimize gas usage
5. **GlueX Monitoring**: Monitor GlueX Router status and performance

### Backend Authorization
```solidity
// Add backend service as authorized caller
function setAuthorizedCaller(address backendService, bool isAuthorized) external onlyOwner
```

## Testing

### Test Scenarios
1. **Gas Deposit/Withdrawal**: Test HYPE token management
2. **Trigger Creation**: Test trigger creation with gas reservation
3. **Allowance Verification**: Test token allowance checks
4. **GlueX Swap Execution**: Test complete swap flow via GlueX Router
5. **Gas Refunds**: Test automatic gas refunds
6. **Emergency Functions**: Test pause/unpause functionality

### GlueX-Specific Testing
1. **Router Integration**: Test GlueX Router calls
2. **Parameter Formatting**: Verify swap data format
3. **Response Parsing**: Test result parsing accuracy
4. **Error Handling**: Test GlueX Router failures
5. **Gas Usage**: Verify gas estimation accuracy

### Test Networks
- Use GlueX testnet for integration testing
- Test with small amounts and real tokens
- Verify GlueX Router integration
- Test gas estimation accuracy

## Security Considerations

### User Protection
- Users maintain control of their tokens until swap execution
- Slippage protection prevents unfavorable trades
- Gas deposits are protected from over-withdrawal

### Contract Security
- Reentrancy protection prevents attack vectors
- Access control limits who can execute swaps
- Emergency functions allow quick response to issues

### GlueX Integration Security
- **Router Verification**: Verify GlueX Router address
- **Parameter Validation**: Validate all swap parameters
- **Response Verification**: Verify swap results
- **Error Handling**: Handle GlueX Router failures gracefully

### Backend Security
- Backend services must be carefully managed
- Price feeds should be from trusted sources
- Execution logic should be thoroughly tested
- GlueX Router status should be monitored

## Support

For questions or issues:
1. Check the contract code and documentation
2. Verify GlueX Router configuration
3. Test GlueX integration on testnet
4. Review gas estimation and fee settings
5. Consult GlueX documentation for router interface
6. Test with small amounts before mainnet deployment

## GlueX Resources

- **Router Documentation**: [GlueX Router Interface](https://docs.gluex.xyz)
- **API Endpoints**: [GlueX API Reference](https://api.gluex.xyz)
- **Testnet**: [GlueX Testnet](https://testnet.gluex.xyz)
- **Support**: [GlueX Support](https://support.gluex.xyz) 