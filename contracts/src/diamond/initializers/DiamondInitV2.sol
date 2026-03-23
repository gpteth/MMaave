// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../AppStorage.sol";

/// @title DiamondInitV2 - V7 等级扩展迁移
/// @notice 通过 diamondCut() 的 _init 参数以 delegatecall 调用
/// @dev 设置 V7 门槛和费率，更新推荐奖和池子分配比例
contract DiamondInitV2 {
    function init() external {
        AppStorage storage s = LibAppStorage.appStorage();

        // ── 推荐奖调整: 2代制，各50%池子 ──
        s.referralGen1 = 5000;               // 第1代: 50% of 推荐池 = 10% 绝对
        s.referralGen2 = 5000;               // 第2代: 50% of 推荐池 = 10% 绝对
        s.referralGen3 = 0;                  // 第3代: 取消

        // ── 动态池分配: 推荐20% + 团队70% + 平级10% ──
        s.referralSharePercent = 2000;       // 推荐池占动态 20%
        s.teamSharePercent = 7000;           // 团队池占动态 70%
        s.sameLevelSharePercent = 1000;      // 平级池占动态 10%

        // ── V1-V6 门槛更新 ──
        s.vLevelThresholds = [
            uint128(3_000e18),               // V1: 3,000
            uint128(10_000e18),              // V2: 10,000
            uint128(50_000e18),              // V3: 50,000
            uint128(150_000e18),             // V4: 150,000
            uint128(500_000e18),             // V5: 500,000
            uint128(1_000_000e18)            // V6: 1,000,000
        ];

        // ── V1-V6 费率更新 ──
        s.vLevelRates = [
            uint16(1000),                    // V1: 10%
            uint16(2000),                    // V2: 20%
            uint16(3000),                    // V3: 30%
            uint16(4000),                    // V4: 40%
            uint16(5000),                    // V5: 50%
            uint16(6000)                     // V6: 60%
        ];

        // ── V7 新增 ──
        s.vLevelThreshold7 = 2_000_000e18;  // V7: 2,000,000
        s.vLevelRate7 = 7000;               // V7: 70%
    }
}
