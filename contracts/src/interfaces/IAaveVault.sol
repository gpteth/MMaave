// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAaveVault - Diamond 调用 AaveVault 的接口
interface IAaveVault {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount, address to) external;
    function getBalance() external view returns (uint256);
}
