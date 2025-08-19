# HyperEVM Order Trigger Flowchart Analysis

This document provides a detailed technical analysis of the HyperEVM Order Trigger Flowchart, explaining how each step is implemented in the smart contracts and backend systems.

## 🔍 Flowchart Overview

The flowchart illustrates the complete lifecycle of an order trigger, from creation to execution, including all decision points, validations, and failure handling mechanisms.

## 📋 Step-by-Step Technical Analysis

### 1. User Creates Trigger
**Implementation**: Frontend form submission to backend API
**Technical Details**:
- User specifies: input token, output token, price condition, amount
- Protocol fee calculation: 0.5% of transaction value
- Backend validates input parameters and stores trigger in database

**Code Location**: Backend API endpoints (not in contracts folder)

### 2. Input Token Validation - HYPE Check
**Decision Point**: `Is input token HYPE?`
**Implementation**: Backend validation logic
**Technical Details**:
- Token address comparison against HYPE native token address
- If HYPE: triggers WHYPE wrapping flow
- If other token: proceeds to allowance checking

**Code Location**: Backend validation services

### 3. WHYPE Balance Check
**Decision Point**: `do they hold enough WHYPE?`
**Implementation**: Smart contract balance checking
**Technical Details**:
- Call `WHYPE.balanceOf(userAddress)` on WHYPE contract
- Compare against required amount for trigger
- Always proceeds to wrapping if input is HYPE (as per flowchart logic)

**Code Location**: `WrapHype.py` - balance checking functions

### 4. HYPE Wrapping Process
**Action**: `Call HYPE contract to wrap`
**Implementation**: WHYPE contract interaction
**Technical Details**:
- Uses official WHYPE contract (WETH9 standard)
- Function: `WHYPE.deposit()` - converts native HYPE to WHYPE
- User must have sufficient native HYPE balance
- Gas cost: ~21,000 gas for basic transfer

**Code Location**: `WrapHype.py` - `wrap_hype()` method

### 5. Allowance Validation
**Decision Point**: `Check ERC20 and internal allowance`
**Implementation**: Dual allowance checking system
**Technical Details**:
- **ERC20 Allowance**: `WHYPE.allowance(user, contractAddress)`
- **Internal Allowance**: `Main.getApprovedAmount(user, token)`
- Both must be sufficient for the trigger amount

**Code Location**: `Allowance.py` - `check_allowance_status()` method

### 6. Insufficient Allowance Handling
**Decision Point**: `enough allowance for both?`
**Implementation**: User approval workflow
**Technical Details**:
- **ERC20 Approval**: User calls `WHYPE.approve(contractAddress, amount)`
- **Internal Approval**: User calls `Main.approveTokens(token, amount)`
- User can choose infinite or finite allowance
- Two separate transactions required

**Code Location**: 
- ERC20: `Allowance.py` - `set_erc20_allowance()`
- Internal: `Allowance.py` - `set_internal_allowance()`

### 7. Trigger Storage
**Action**: `Trigger lives on database`
**Implementation**: Backend database storage
**Technical Details**:
- Trigger stored with: user, tokens, amounts, price conditions, allowances
- Backend continuously monitors price feeds
- No blockchain interaction at this stage

**Code Location**: Backend database services (not in contracts folder)

### 8. Trigger Activation
**Action**: `Trigger is hit`
**Implementation**: Backend price monitoring + smart contract execution
**Technical Details**:
- Backend detects price condition fulfillment
- Calls `Main.withdrawOnTrigger(user, token, amount)`
- Only contract owner can call this function
- Gas cost: ~65,000 gas for token transfer

**Code Location**: `Withdraw.py` - `trigger_withdrawal()` method

### 9. Balance/Allowance Revalidation
**Decision Point**: `balance or allowance not enough`
**Implementation**: Smart contract validation
**Technical Details**:
- Checks current balance: `WHYPE.balanceOf(user)`
- Checks current allowances: Both ERC20 and internal
- If insufficient: transaction reverts, trigger remains active

**Code Location**: `Main.sol` - `withdrawOnTrigger()` function

### 10. Failure Handling
**Action**: `Cancel the trigger and display a warning`
**Implementation**: Backend trigger management
**Technical Details**:
- Backend marks trigger as failed in database
- User notification system activated
- Trigger can be retried or cancelled

**Code Location**: Backend trigger management services

### 11. Successful Fund Transfer
**Action**: `call main.sol with transfer function to move funds to swap wallet`
**Implementation**: Smart contract token transfer
**Technical Details**:
- `Main.withdrawOnTrigger()` executes successfully
- Tokens transferred to dedicated wallet: `0x9E02783Ad42C5A94a0De60394f2996E44458B782`
- Average gas fee: ~0.0005 USD (based on HyperEVM gas prices)

**Code Location**: `Main.sol` - `withdrawOnTrigger()` function

### 12. GLUEX Integration
**Action**: `add recipient address on GlueX swap`
**Implementation**: Backend GLUEX API integration
**Technical Details**:
- Backend uses GLUEX API for token swaps
- User's address added as recipient
- Swapped tokens sent directly to user
- No additional smart contract interaction needed

**Code Location**: Backend GLUEX integration services

## 🔧 Technical Implementation Details

### Gas Optimization
- **Main Contract**: Designed to fit within HyperEVM's 2M gas limit
- **Token Transfers**: Optimized for minimal gas consumption
- **Allowance Checks**: Efficient storage patterns for user allowances

### Security Features
- **Access Control**: Only contract owner can trigger withdrawals
- **Reentrancy Protection**: Prevents attack vectors
- **Pausable**: Emergency stop functionality
- **Dedicated Wallet**: All funds go to specific, controlled address

### Network Considerations
- **HyperEVM Testnet**: Chain ID 424, for testing
- **HyperEVM Mainnet**: Chain ID 999, production deployment
- **Gas Prices**: Optimized for HyperEVM's low-fee environment

## 📊 Data Flow Summary

1. **User Input** → Frontend → Backend API
2. **Token Validation** → Smart Contract Balance Checks
3. **Allowance Management** → Dual Approval System
4. **Trigger Storage** → Backend Database
5. **Price Monitoring** → Backend Services
6. **Execution** → Smart Contract + Backend Integration
7. **Fund Transfer** → Dedicated Wallet
8. **Token Swap** → GLUEX API
9. **Final Delivery** → User Wallet

## 🚨 Critical Paths and Failure Points

### High-Risk Scenarios
1. **Insufficient Balance**: User spends tokens after trigger creation
2. **Allowance Revocation**: User revokes approvals
3. **Network Congestion**: High gas prices affecting execution
4. **Price Feed Issues**: Delayed or inaccurate price data

### Mitigation Strategies
1. **Real-time Validation**: Check balances/allowances before execution
2. **Graceful Degradation**: Handle failures without losing user funds
3. **Retry Mechanisms**: Automatic retry for failed transactions
4. **User Notifications**: Immediate feedback on trigger status

## 🔮 Future Enhancements

### Potential Improvements
1. **Batch Processing**: Multiple triggers in single transaction
2. **Dynamic Gas Pricing**: Adaptive gas cost optimization
3. **Multi-token Support**: Beyond WHYPE/HYPE pairs
4. **Advanced Triggers**: Time-based, volume-based conditions

### Scalability Considerations
1. **Gas Limit Management**: Stay within HyperEVM constraints
2. **Batch Operations**: Reduce transaction overhead
3. **Efficient Storage**: Optimize contract storage patterns
4. **Layer 2 Integration**: Future expansion possibilities
