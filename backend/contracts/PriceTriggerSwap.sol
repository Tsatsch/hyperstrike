// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title PriceTriggerSwap
 * @dev Smart contract for automated token swaps on HyperEVM using GlueX Router
 * Backend controls all trigger logic, contract uses allowances and user gas deposits
 */
contract PriceTriggerSwap is Ownable, ReentrancyGuard, Pausable {
    
    // Events
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp,
        string triggerId,
        uint256 gasUsed
    );
    
    event GasDeposited(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    
    event GasRefunded(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    
    event SwapFailed(
        string indexed triggerId,
        address indexed user,
        string reason,
        uint256 timestamp
    );
    
    // Structs
    struct SwapRequest {
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        bool isActive;
        uint256 createdAt;
        uint256 gasReserved; // Amount of HYPE reserved for this swap
    }
    
    // State variables
    mapping(string => SwapRequest) public swapRequests;
    mapping(address => string[]) public userSwapIds;
    mapping(address => uint256) public userGasDeposits; // HYPE token deposits (native)
    mapping(address => bool) public authorizedCallers;
    
    // GlueX Router address (placeholder - replace with actual address)
    address public constant GLUEX_ROUTER = 0x0000000000000000000000000000000000000000; // TODO: Set actual GlueX Router address
    
    // Wrapped HYPE token address (placeholder - replace with actual address)
    address public constant WHYPE_TOKEN = 0x5555555555555555555555555555555555555555; // TODO: Set actual WHYPE token address
    
    // Native token representation (ETH, MATIC, etc.)
    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    
    // Fees (in basis points, 100 = 1%)
    uint256 public protocolFee = 50; // 0.5%
    uint256 public constant MAX_FEE = 500; // 5%
    
    // Gas estimation for swaps (in HYPE tokens)
    uint256 public estimatedGasPerSwap = 0.01 ether; // Adjust based on actual gas costs
    
    // GlueX API configuration
    string public constant GLUEX_QUOTE_ENDPOINT = "https://router.gluex.xyz/v1/quote";
    
    // Modifiers
    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
    modifier swapRequestExists(string memory swapId) {
        require(swapRequests[swapId].user != address(0), "Swap request does not exist");
        _;
    }
    
    modifier swapRequestActive(string memory swapId) {
        require(swapRequests[swapId].isActive, "Swap request is not active");
        _;
    }
    
    modifier sufficientAllowance(string memory swapId) {
        SwapRequest storage request = swapRequests[swapId];
        require(
            IERC20(request.tokenIn).allowance(request.user, address(this)) >= request.amountIn,
            "Insufficient allowance"
        );
        _;
    }
    
    modifier sufficientGasDeposit(string memory swapId) {
        SwapRequest storage request = swapRequests[swapId];
        require(
            userGasDeposits[request.user] >= request.gasReserved,
            "Insufficient gas deposit"
        );
        _;
    }
    
    modifier sufficientTokenBalance(string memory swapId) {
        SwapRequest storage request = swapRequests[swapId];
        require(
            IERC20(request.tokenIn).balanceOf(request.user) >= request.amountIn,
            "Insufficient token balance"
        );
        _;
    }
    
    constructor() {
        authorizedCallers[msg.sender] = true;
    }
    
    /**
     * @dev Create a swap request (called by backend only)
     * @param swapId Unique identifier for the swap request
     * @param user Address of the user
     * @param tokenIn Token to swap from
     * @param tokenOut Token to swap to
     * @param amountIn Amount of tokenIn to swap
     * @param minAmountOut Minimum amount of tokenOut to receive
     */
    function createSwapRequest(
        string memory swapId,
        address user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external onlyAuthorized whenNotPaused {
        require(bytes(swapId).length > 0, "Invalid swap ID");
        require(user != address(0), "Invalid user address");
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token addresses");
        require(amountIn > 0, "Invalid amount");
        require(swapRequests[swapId].user == address(0), "Swap ID already exists");
        
        // Check if user has sufficient gas deposit
        uint256 gasRequired = estimatedGasPerSwap;
        require(userGasDeposits[user] >= gasRequired, "Insufficient gas deposit");
        
        // Reserve gas for this swap request
        userGasDeposits[user] -= gasRequired;
        
        // Create swap request record
        swapRequests[swapId] = SwapRequest({
            user: user,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: minAmountOut,
            isActive: true,
            createdAt: block.timestamp,
            gasReserved: gasRequired
        });
        
        userSwapIds[user].push(swapId);
    }
    
    /**
     * @dev Execute swap when backend determines conditions are met
     * @param swapId ID of the swap request to execute
     */
    function executeSwap(
        string memory swapId
    ) external onlyAuthorized swapRequestExists(swapId) swapRequestActive(swapId) 
        sufficientAllowance(swapId) sufficientGasDeposit(swapId) sufficientTokenBalance(swapId) 
        nonReentrant whenNotPaused {
        
        SwapRequest storage request = swapRequests[swapId];
        
        // Deactivate swap request
        request.isActive = false;
        
        // Check if user has sufficient token balance
        if (IERC20(request.tokenIn).balanceOf(request.user) < request.amountIn) {
            // Refund reserved gas and emit failure event
            userGasDeposits[request.user] += request.gasReserved;
            
            emit SwapFailed(
                swapId,
                request.user,
                "Insufficient token balance",
                block.timestamp
            );
            return;
        }
        
        // Calculate protocol fee
        uint256 feeAmount = (request.amountIn * protocolFee) / 10000;
        uint256 swapAmount = request.amountIn - feeAmount;
        
        // Transfer tokens from user to contract (using allowance)
        IERC20(request.tokenIn).transferFrom(request.user, address(this), request.amountIn);
        
        // Execute swap on GlueX Router
        uint256 amountOut = _executeGlueXSwap(swapId, request, swapAmount);
        
        // Transfer fee to protocol
        if (feeAmount > 0) {
            IERC20(request.tokenIn).transfer(owner(), feeAmount);
        }
        
        // Transfer swapped tokens to user
        IERC20(request.tokenOut).transfer(request.user, amountOut);
        
        // Calculate actual gas used and refund excess
        uint256 actualGasUsed = _estimateActualGasUsed();
        uint256 gasRefund = request.gasReserved - actualGasUsed;
        
        if (gasRefund > 0) {
            userGasDeposits[request.user] += gasRefund;
        }
        
        emit SwapExecuted(
            request.user,
            request.tokenIn,
            request.tokenOut,
            request.amountIn,
            amountOut,
            block.timestamp,
            swapId,
            actualGasUsed
        );
    }
    
    /**
     * @dev Cancel swap request and get gas refund (called by backend only)
     * @param swapId ID of the swap request to cancel
     */
    function cancelSwapRequest(string memory swapId) external onlyAuthorized swapRequestExists(swapId) swapRequestActive(swapId) {
        SwapRequest storage request = swapRequests[swapId];
        
        // Deactivate swap request
        request.isActive = false;
        
        // Refund reserved gas
        userGasDeposits[request.user] += request.gasReserved;
    }
    
    /**
     * @dev Deposit HYPE tokens for gas fees (native token - no approval needed)
     */
    function depositGas() external payable whenNotPaused {
        require(msg.value > 0, "Invalid amount");
        
        // Add to user's gas deposit
        userGasDeposits[msg.sender] += msg.value;
        
        emit GasDeposited(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Withdraw unused HYPE tokens
     * @param amount Amount of HYPE tokens to withdraw
     */
    function withdrawGas(uint256 amount) external whenNotPaused {
        require(amount > 0, "Invalid amount");
        require(userGasDeposits[msg.sender] >= amount, "Insufficient gas deposit");
        
        // Check if user has any active swap requests that might need gas
        uint256 totalGasReserved = 0;
        string[] storage userSwaps = userSwapIds[msg.sender];
        
        for (uint256 i = 0; i < userSwaps.length; i++) {
            if (swapRequests[userSwaps[i]].isActive) {
                totalGasReserved += swapRequests[userSwaps[i]].gasReserved;
            }
        }
        
        uint256 availableForWithdrawal = userGasDeposits[msg.sender] - totalGasReserved;
        require(amount <= availableForWithdrawal, "Amount exceeds available for withdrawal");
        
        // Deduct from user's gas deposit
        userGasDeposits[msg.sender] -= amount;
        
        // Transfer HYPE tokens back to user (native token transfer)
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "HYPE transfer failed");
        
        emit GasRefunded(msg.sender, amount, block.timestamp);
    }
    
    /**
     * @dev Internal function to execute swap on GlueX Router
     * @return amountOut Amount of tokens received from swap
     */
    function _executeGlueXSwap(
        string memory swapId,
        SwapRequest memory request,
        uint256 swapAmount
    ) internal returns (uint256 amountOut) {
        // Approve router to spend tokens
        IERC20(request.tokenIn).approve(GLUEX_ROUTER, swapAmount);
        
        // Prepare swap data for GlueX Router
        bytes memory swapData = _prepareGlueXSwapData(request, swapAmount);
        
        // Execute swap on GlueX Router
        (bool success, bytes memory result) = GLUEX_ROUTER.call(swapData);
        require(success, "GlueX swap failed");
        
        // Parse the result to get amountOut
        // Note: This is a simplified implementation. In production, you'll need to
        // handle the actual response format from GlueX Router
        amountOut = _parseGlueXSwapResult(result, request.minAmountOut);
        
        // Verify minimum output amount
        require(amountOut >= request.minAmountOut, "Insufficient output amount");
    }
    
    /**
     * @dev Prepare swap data for GlueX Router
     * @param request Swap request details
     * @param swapAmount Amount to swap
     * @return swapData Formatted swap data for GlueX Router
     */
    function _prepareGlueXSwapData(
        SwapRequest memory request,
        uint256 swapAmount
    ) internal pure returns (bytes memory swapData) {
        // GlueX Router expects specific calldata format
        // This is a placeholder implementation - adjust based on actual GlueX interface
        
        // Example: swapExactTokensForTokens
        // Parameters: (amountIn, amountOutMin, path, to, deadline)
        address[] memory path = new address[](2);
        path[0] = request.tokenIn;
        path[1] = request.tokenOut;
        
        // Encode function call
        swapData = abi.encodeWithSelector(
            bytes4(keccak256("swapExactTokensForTokens(uint256,uint256,address[],address,uint256)")),
            swapAmount,                    // amountIn
            request.minAmountOut,          // amountOutMin
            path,                          // path
            address(this),                 // to (contract receives tokens first)
            block.timestamp + 300          // deadline (5 minutes)
        );
        
        // TODO: Implement actual GlueX Router interface based on their documentation
        // The above is a generic ERC20 swap interface - GlueX may have different methods
    }
    
    /**
     * @dev Parse swap result from GlueX Router
     * @param result Raw result from router call
     * @param minAmountOut Minimum expected output
     * @return amountOut Actual amount received
     */
    function _parseGlueXSwapResult(
        bytes memory result,
        uint256 minAmountOut
    ) internal pure returns (uint256 amountOut) {
        // Parse the result to extract amountOut
        // This is a placeholder - implement based on actual GlueX response format
        
        if (result.length >= 32) {
            // Assume first 32 bytes contain the amountOut
            amountOut = abi.decode(result, (uint256));
        } else {
            // Fallback to minimum amount if parsing fails
            amountOut = minAmountOut;
        }
        
        // TODO: Implement proper result parsing based on GlueX Router response format
    }
    
    /**
     * @dev Estimate actual gas used for the swap (placeholder)
     * @return gasUsed Estimated gas used in HYPE tokens
     */
    function _estimateActualGasUsed() internal view returns (uint256 gasUsed) {
        // TODO: Implement actual gas estimation based on GlueX Router gas costs
        // For now, return a conservative estimate
        gasUsed = estimatedGasPerSwap * 80 / 100; // Assume 80% of estimated gas is used
    }
    
    /**
     * @dev Get all swap IDs for a user
     * @param user Address of the user
     * @return Array of swap IDs
     */
    function getUserSwaps(address user) external view returns (string[] memory) {
        return userSwapIds[user];
    }
    
    /**
     * @dev Get swap request details
     * @param swapId ID of the swap request
     * @return Swap request details
     */
    function getSwapRequest(string memory swapId) external view returns (SwapRequest memory) {
        return swapRequests[swapId];
    }
    
    /**
     * @dev Get user's gas deposit balance
     * @param user Address of the user
     * @return Gas deposit balance
     */
    function getUserGasBalance(address user) external view returns (uint256) {
        return userGasDeposits[user];
    }
    
    /**
     * @dev Add or remove authorized caller (backend service)
     * @param caller Address to authorize/unauthorize
     * @param isAuthorized Whether to authorize or unauthorize
     */
    function setAuthorizedCaller(address caller, bool isAuthorized) external onlyOwner {
        authorizedCallers[caller] = isAuthorized;
    }
    
    /**
     * @dev Update protocol fee
     * @param newFee New fee in basis points
     */
    function setProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= MAX_FEE, "Fee too high");
        protocolFee = newFee;
    }
    
    /**
     * @dev Update estimated gas per swap
     * @param newGasEstimate New gas estimate in HYPE tokens
     */
    function setEstimatedGasPerSwap(uint256 newGasEstimate) external onlyOwner {
        estimatedGasPerSwap = newGasEstimate;
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency function to withdraw stuck tokens
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
    
    /**
     * @dev Emergency function to withdraw stuck HYPE (native tokens)
     * @param amount Amount of HYPE to withdraw
     */
    function emergencyWithdrawHYPE(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient HYPE balance");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "HYPE transfer failed");
    }
    
    /**
     * @dev Get path for swap (simplified - adjust based on GlueX requirements)
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @return Path array
     */
    function _getPath(address tokenIn, address tokenOut) internal pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        return path;
    }
    
    /**
     * @dev Receive function to accept HYPE deposits
     */
    receive() external payable {
        // Allow direct HYPE deposits
        userGasDeposits[msg.sender] += msg.value;
        emit GasDeposited(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {
        // Reject unexpected calls
        revert("Unexpected call");
    }
} 