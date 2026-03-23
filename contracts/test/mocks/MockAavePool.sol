// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../src/interfaces/IAavePool.sol";
import "./MockERC20.sol";

/**
 * @title MockAavePool
 * @notice Simulates AAVE V3 supply/withdraw for testing.
 *         Holds USDT and mints aTokens 1:1 on supply, burns on withdraw.
 */
contract MockAavePool is IAavePool {
    using SafeERC20 for IERC20;

    IERC20 public usdt;
    MockERC20 public aToken;

    constructor(address _usdt, address _aToken) {
        usdt = IERC20(_usdt);
        aToken = MockERC20(_aToken);
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16) external override {
        require(asset == address(usdt), "Wrong asset");
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        aToken.mint(onBehalfOf, amount);
    }

    function withdraw(address asset, uint256 amount, address to) external override returns (uint256) {
        require(asset == address(usdt), "Wrong asset");
        // Burn aTokens from the caller (AaveVault)
        aToken.burn(msg.sender, amount);
        // Transfer USDT to recipient
        IERC20(asset).safeTransfer(to, amount);
        return amount;
    }
}
