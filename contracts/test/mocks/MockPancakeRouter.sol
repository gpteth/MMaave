// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../src/interfaces/IPancakeRouter.sol";
import "./MockERC20.sol";

/**
 * @title MockPancakeRouter
 * @notice Simulates PancakeSwap V3 swaps for testing. 1:1 rate USDT->MM.
 */
contract MockPancakeRouter is IPancakeRouter {
    using SafeERC20 for IERC20;

    MockERC20 public mmToken;

    constructor(address _mmToken) {
        mmToken = MockERC20(_mmToken);
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable override returns (uint256) {
        // Take USDT from caller
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        // Mint MM tokens 1:1 and send to recipient
        uint256 amountOut = params.amountIn; // 1:1 for testing
        require(amountOut >= params.amountOutMinimum, "Slippage");
        mmToken.mint(params.recipient, amountOut);

        return amountOut;
    }
}
