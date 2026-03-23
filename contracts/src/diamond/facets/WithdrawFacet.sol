// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeCast.sol";
import "../Modifiers.sol";
import "../../interfaces/IAaveVault.sol";

/// @title WithdrawFacet - 提现与紧急代币救援
/// @dev ⚠️ 修改注意事项:
///      1. withdraw() 涉及资金转出，修改时严格遵循 checks-effects-interactions
///      2. USDT 从 AaveVault (Aave Pool) 提取后直接发送给用户
///      3. rescueTokens 仅 owner 可调用，用于取回误转入的代币
contract WithdrawFacet is Modifiers {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /// @notice 用户提现
    /// @dev 流程:
    ///      1. 检查金额（≥ minWithdrawal, 10的倍数）
    ///      2. 检查用户状态和余额
    ///      3. 扣减余额（Effects）
    ///      4. 计算手续费
    ///      5. 从 receiverWallet 转 USDT 给用户（Interactions）
    ///      6. 手续费转给 feeCollector
    /// @param amount 提现金额 (USDT, 18 decimals)
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        AppStorage storage s = LibAppStorage.appStorage();
        address user = msg.sender;

        // ── Checks ──
        if (amount < s.minWithdrawal) revert BelowMinWithdrawal();
        if (amount % 10e18 != 0) revert NotMultipleOf10();

        Member storage member = s.members[user];
        if (!member.isActive) revert NotActive();
        if (member.isFrozen) revert AccountFrozen();
        if (member.isPaused) revert AccountPaused();
        if (member.balance < amount.toUint128()) revert InsufficientBalance();

        // ── Effects: 先扣减余额 ──
        uint256 fee = (amount * s.withdrawalFee) / 10000;
        uint256 netAmount = amount - fee;

        member.balance -= amount.toUint128();
        member.totalWithdrawn += amount.toUint128();

        // ── Interactions: 提取 USDT ──
        if (s.useAave) {
            // 经 Aave: AaveVault → Aave Pool → 用户
            if (netAmount > 0) {
                IAaveVault(s.aaveVault).withdraw(netAmount, user);
            }
            if (fee > 0 && s.feeCollector != address(0)) {
                IAaveVault(s.aaveVault).withdraw(fee, s.feeCollector);
            }
        } else {
            // 直转: receiverWallet → 用户
            if (netAmount > 0) {
                IERC20(s.usdt).safeTransferFrom(s.receiverWallet, user, netAmount);
            }
            if (fee > 0 && s.feeCollector != address(0)) {
                IERC20(s.usdt).safeTransferFrom(s.receiverWallet, s.feeCollector, fee);
            }
        }

        emit Withdrawn(user, amount, fee, netAmount);
    }

    /// @notice 紧急救援误转入 Diamond 合约的代币（Owner Only）
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(LibDiamond.contractOwner(), amount);
    }
}
