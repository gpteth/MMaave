// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../Modifiers.sol";
import "../libraries/LibMemePlus.sol";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                  ConfigFacet - 管理与配置 Facet                              ║
// ║                                                                              ║
// ║  ⚠️ 修改注意事项:                                                            ║
// ║  1. 新增 setter/getter 函数后需通过 diamondCut(Add) 注册选择器               ║
// ║  2. getter 函数（view）不涉及存储写入，升级风险低                             ║
// ║  3. 权限分两级: onlyOwner (最高) 和 onlyAdmin (管理员)                       ║
// ║  4. 修改参数范围检查时要考虑已有线上数据的兼容性                               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/// @title ConfigFacet - 管理员权限管理、参数配置、config getter
/// @notice 提供管理员增删、会员控制、全局暂停、各种参数 setter/getter
contract ConfigFacet is Modifiers {
    // ======================== 管理员管理 (Owner Only) ========================

    /// @notice 添加管理员
    function addAdmin(address account) external onlyOwner {
        AppStorage storage s = LibAppStorage.appStorage();
        s.roles[ADMIN_ROLE][account] = true;
        s.isAdmin[account] = true;
        emit AdminAdded(account);
    }

    /// @notice 移除管理员
    function removeAdmin(address account) external onlyOwner {
        AppStorage storage s = LibAppStorage.appStorage();
        s.roles[ADMIN_ROLE][account] = false;
        s.isAdmin[account] = false;
        emit AdminRemoved(account);
    }

    /// @notice 查询角色
    /// @dev DEFAULT_ADMIN_ROLE (0x00) 返回是否为 owner
    function hasRole(bytes32 role, address account) external view returns (bool) {
        AppStorage storage s = LibAppStorage.appStorage();
        if (role == DEFAULT_ADMIN_ROLE) return account == LibDiamond.contractOwner();
        return s.roles[role][account];
    }

    // ======================== 会员控制 (Admin) ========================

    /// @notice 冻结会员（完全禁止操作）
    function freezeMember(address member) external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();
        s.members[member].isFrozen = true;
        emit ParameterUpdated("freezeMember", uint256(uint160(member)));
    }

    function unfreezeMember(address member) external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();
        s.members[member].isFrozen = false;
        emit ParameterUpdated("unfreezeMember", uint256(uint160(member)));
    }

    /// @notice 暂停会员（临时禁止操作）
    function pauseMember(address member) external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();
        s.members[member].isPaused = true;
        emit ParameterUpdated("pauseMember", uint256(uint160(member)));
    }

    function unpauseMember(address member) external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();
        s.members[member].isPaused = false;
        emit ParameterUpdated("unpauseMember", uint256(uint160(member)));
    }

    /// @notice 设置社区等级 (0-5)
    function setCommunityLevel(address member, uint8 level) external onlyAdmin {
        if (level > 5) revert InvalidLevel();
        AppStorage storage s = LibAppStorage.appStorage();
        s.members[member].communityLevel = level;
    }

    /// @notice 手动设置 V 等级 (0-7)
    function setMemberVLevel(address member, uint8 level) external onlyAdmin {
        if (level > 7) revert InvalidLevel();
        AppStorage storage s = LibAppStorage.appStorage();
        s.members[member].vLevel = level;
        emit ParameterUpdated("setMemberVLevel", uint256(uint160(member)));
    }

    /// @notice 批量设置 V 等级（最多 100 个）
    function setMemberVLevelBatch(address[] calldata members, uint8[] calldata levels) external onlyAdmin {
        if (members.length != levels.length) revert ArrayLengthMismatch();
        if (members.length > 100) revert BatchTooLarge();
        AppStorage storage s = LibAppStorage.appStorage();
        for (uint256 i; i < members.length;) {
            if (levels[i] > 7) revert InvalidLevel();
            s.members[members[i]].vLevel = levels[i];
            unchecked { ++i; }
        }
    }

    /// @notice 批量重新计算 V 等级（基于当前小区业绩）
    /// @dev 用于重置后重算，或业绩变化后手动触发升级
    function recalculateVLevels(address[] calldata users) external onlyAdmin {
        if (users.length > 100) revert BatchTooLarge();
        AppStorage storage s = LibAppStorage.appStorage();
        for (uint256 i; i < users.length;) {
            LibMemePlus.updateVLevel(s, users[i]);
            unchecked { ++i; }
        }
    }

    /// @notice 批量设置社区等级（最多 100 个）
    function setCommunityLevelBatch(address[] calldata members, uint8[] calldata levels) external onlyAdmin {
        if (members.length != levels.length) revert ArrayLengthMismatch();
        if (members.length > 100) revert BatchTooLarge();
        AppStorage storage s = LibAppStorage.appStorage();
        for (uint256 i; i < members.length;) {
            if (levels[i] > 5) revert InvalidLevel();
            s.members[members[i]].communityLevel = levels[i];
            unchecked { ++i; }
        }
    }

    // ======================== 全局暂停 ========================

    function pause() external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();
        s.paused = true;
        emit Paused();
    }

    function unpause() external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();
        s.paused = false;
        emit Unpaused();
    }

    // ======================== 参数设置 (Admin) ========================
    // 所有比例参数使用 BPS (基点)，10000 = 100%

    /// @notice 设置日收益率（上限 5%）
    function setDailyReturnRate(uint16 val) external onlyAdmin {
        if (val > 500) revert FeeTooHigh();
        AppStorage storage s = LibAppStorage.appStorage();
        s.dailyReturnRate = val;
        emit ParameterUpdated("dailyReturnRate", val);
    }

    /// @notice 设置静态/动态收益比例（必须加起来等于 10000）
    function setStaticDynamicSplit(uint16 _static, uint16 _dynamic) external onlyAdmin {
        if (_static + _dynamic != 10000) revert MustSumTo10000();
        AppStorage storage s = LibAppStorage.appStorage();
        s.staticPercent = _static;
        s.dynamicPercent = _dynamic;
    }

    /// @notice 设置静态收益的三向分配比例（余额+销毁+锁仓 = 10000）
    function setStaticDistribution(uint16 _toBalance, uint16 _toBurn, uint16 _toLock) external onlyAdmin {
        if (_toBalance + _toBurn + _toLock != 10000) revert MustSumTo10000();
        AppStorage storage s = LibAppStorage.appStorage();
        s.staticToBalance = _toBalance;
        s.staticToBurn = _toBurn;
        s.staticToLock = _toLock;
    }

    /// @notice 设置三代推荐奖比例
    function setReferralRates(uint16 _gen1, uint16 _gen2, uint16 _gen3) external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();
        s.referralGen1 = _gen1;
        s.referralGen2 = _gen2;
        s.referralGen3 = _gen3;
    }

    /// @notice 设置动态收益中推荐池/团队池/平级池比例（必须加起来等于 10000）
    function setDynamicPoolSplit(uint16 _referral, uint16 _team, uint16 _sameLevel) external onlyAdmin {
        if (_referral + _team + _sameLevel != 10000) revert MustSumTo10000();
        AppStorage storage s = LibAppStorage.appStorage();
        s.referralSharePercent = _referral;
        s.teamSharePercent = _team;
        s.sameLevelSharePercent = _sameLevel;
    }

    /// @notice 设置收益封顶倍数（100-1000 即 1x-10x）
    function setCapMultiplier(uint16 val) external onlyAdmin {
        if (val < 100 || val > 1000) revert InvalidLevel();
        AppStorage storage s = LibAppStorage.appStorage();
        s.capMultiplier = val;
    }

    /// @notice 设置提现手续费（上限 50%）
    function setWithdrawalFee(uint16 val) external onlyAdmin {
        if (val > 5000) revert FeeTooHigh();
        AppStorage storage s = LibAppStorage.appStorage();
        s.withdrawalFee = val;
    }

    function setMinInvestment(uint128 val) external onlyAdmin {
        LibAppStorage.appStorage().minInvestment = val;
    }

    function setMinWithdrawal(uint128 val) external onlyAdmin {
        LibAppStorage.appStorage().minWithdrawal = val;
    }

    /// @notice 设置平级奖比例（上限 30%）
    function setSameLevelBonus(uint16 val) external onlyAdmin {
        if (val > 3000) revert FeeTooHigh();
        LibAppStorage.appStorage().sameLevelBonus = val;
    }

    /// @notice 设置 V1-V6 等级门槛数组
    function setVLevelThresholds(uint128[6] calldata thresholds) external onlyAdmin {
        LibAppStorage.appStorage().vLevelThresholds = thresholds;
    }

    /// @notice 设置 V1-V6 等级费率数组（必须递增）
    function setVLevelRates(uint16[6] calldata rates) external onlyAdmin {
        for (uint256 i = 1; i < 6; i++) {
            if (rates[i] < rates[i - 1]) revert InvalidLevel();
        }
        LibAppStorage.appStorage().vLevelRates = rates;
    }

    /// @notice 设置 V7 等级门槛
    function setVLevel7Threshold(uint128 threshold) external onlyAdmin {
        LibAppStorage.appStorage().vLevelThreshold7 = threshold;
    }

    /// @notice 设置 V7 等级费率（必须 >= V6 费率）
    function setVLevel7Rate(uint16 rate) external onlyAdmin {
        AppStorage storage s = LibAppStorage.appStorage();
        if (rate < s.vLevelRates[5]) revert InvalidLevel();
        s.vLevelRate7 = rate;
    }

    /// @notice 设置社区等级费率数组（必须递减）
    function setCommunityRates(uint16[5] calldata rates) external onlyAdmin {
        for (uint256 i = 1; i < 5; i++) {
            if (rates[i] > rates[i - 1]) revert InvalidLevel();
        }
        LibAppStorage.appStorage().communityRates = rates;
    }

    function setRestartMMCompPercent(uint16 val) external onlyAdmin {
        if (val > 5000) revert FeeTooHigh();
        LibAppStorage.appStorage().restartMMCompPercent = val;
    }

    function setRestartReferralRate(uint16 val) external onlyAdmin {
        LibAppStorage.appStorage().restartReferralRate = val;
    }

    function setRestartReferralCap(uint16 val) external onlyAdmin {
        LibAppStorage.appStorage().restartReferralCap = val;
    }

    function setRestartMMReleaseRate(uint16 val) external onlyAdmin {
        LibAppStorage.appStorage().restartMMReleaseRate = val;
    }

    function setPerpetualBCKPercent(uint16 val) external onlyAdmin {
        LibAppStorage.appStorage().perpetualBCKPercent = val;
        emit ParameterUpdated("perpetualBCKPercent", val);
    }

    function setBCKPrice(uint256 val) external onlyAdmin {
        if (val == 0) revert ZeroAmount();
        LibAppStorage.appStorage().bckPrice = val;
        emit ParameterUpdated("bckPrice", val);
    }

    /// @notice 设置结算间隔（1小时 - 7天）
    function setSettlementInterval(uint256 val) external onlyAdmin {
        if (val < 1 hours || val > 7 days) revert InvalidLevel();
        LibAppStorage.appStorage().settlementInterval = val;
        emit ParameterUpdated("settlementInterval", val);
    }

    /// @notice 设置资金接收钱包（Owner Only）
    function setReceiverWallet(address _wallet) external onlyOwner {
        if (_wallet == address(0)) revert ZeroAddress();
        LibAppStorage.appStorage().receiverWallet = _wallet;
        emit ParameterUpdated("receiverWallet", uint256(uint160(_wallet)));
    }

    /// @notice 设置手续费收集地址（Owner Only）
    function setFeeCollector(address _collector) external onlyOwner {
        if (_collector == address(0)) revert ZeroAddress();
        LibAppStorage.appStorage().feeCollector = _collector;
    }

    /// @notice 设置 AaveVault 代理地址（Owner Only）
    function setAaveVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        LibAppStorage.appStorage().aaveVault = _vault;
        emit ParameterUpdated("aaveVault", uint256(uint160(_vault)));
    }

    // ======================== Config Getters ========================

    function dailyReturnRate() external view returns (uint16) { return LibAppStorage.appStorage().dailyReturnRate; }
    function staticPercent() external view returns (uint16) { return LibAppStorage.appStorage().staticPercent; }
    function dynamicPercent() external view returns (uint16) { return LibAppStorage.appStorage().dynamicPercent; }
    function staticToBalance() external view returns (uint16) { return LibAppStorage.appStorage().staticToBalance; }
    function staticToBurn() external view returns (uint16) { return LibAppStorage.appStorage().staticToBurn; }
    function staticToLock() external view returns (uint16) { return LibAppStorage.appStorage().staticToLock; }
    function referralGen1() external view returns (uint16) { return LibAppStorage.appStorage().referralGen1; }
    function referralGen2() external view returns (uint16) { return LibAppStorage.appStorage().referralGen2; }
    function referralGen3() external view returns (uint16) { return LibAppStorage.appStorage().referralGen3; }
    function referralSharePercent() external view returns (uint16) { return LibAppStorage.appStorage().referralSharePercent; }
    function teamSharePercent() external view returns (uint16) { return LibAppStorage.appStorage().teamSharePercent; }
    function capMultiplier() external view returns (uint16) { return LibAppStorage.appStorage().capMultiplier; }
    function withdrawalFee() external view returns (uint16) { return LibAppStorage.appStorage().withdrawalFee; }
    function minInvestment() external view returns (uint128) { return LibAppStorage.appStorage().minInvestment; }
    function minWithdrawal() external view returns (uint128) { return LibAppStorage.appStorage().minWithdrawal; }
    function sameLevelBonus() external view returns (uint16) { return LibAppStorage.appStorage().sameLevelBonus; }
    function sameLevelSharePercent() external view returns (uint16) { return LibAppStorage.appStorage().sameLevelSharePercent; }
    function vLevelThresholds(uint256 i) external view returns (uint128) { return LibAppStorage.appStorage().vLevelThresholds[i]; }
    function vLevelRates(uint256 i) external view returns (uint16) { return LibAppStorage.appStorage().vLevelRates[i]; }
    function vLevelThreshold7() external view returns (uint128) { return LibAppStorage.appStorage().vLevelThreshold7; }
    function vLevelRate7() external view returns (uint16) { return LibAppStorage.appStorage().vLevelRate7; }
    function communityRates(uint256 i) external view returns (uint16) { return LibAppStorage.appStorage().communityRates[i]; }
    function restartMMCompPercent() external view returns (uint16) { return LibAppStorage.appStorage().restartMMCompPercent; }
    function restartReferralRate() external view returns (uint16) { return LibAppStorage.appStorage().restartReferralRate; }
    function restartReferralCap() external view returns (uint16) { return LibAppStorage.appStorage().restartReferralCap; }
    function restartMMReleaseRate() external view returns (uint16) { return LibAppStorage.appStorage().restartMMReleaseRate; }
    function perpetualBCKPercent() external view returns (uint16) { return LibAppStorage.appStorage().perpetualBCKPercent; }
    function bckPrice() external view returns (uint256) { return LibAppStorage.appStorage().bckPrice; }
    function receiverWallet() external view returns (address) { return LibAppStorage.appStorage().receiverWallet; }
    function paused() external view returns (bool) { return LibAppStorage.appStorage().paused; }
    function settlementInterval() external view returns (uint256) { return LibAppStorage.appStorage().settlementInterval; }
    function feeCollector() external view returns (address) { return LibAppStorage.appStorage().feeCollector; }
    function currentEpoch() external view returns (uint256) { return LibAppStorage.appStorage().currentEpoch; }
    function lastSettledAt() external view returns (uint256) { return LibAppStorage.appStorage().lastSettledAt; }
    function isAdmin(address account) external view returns (bool) { return LibAppStorage.appStorage().isAdmin[account]; }
    function aaveVault() external view returns (address) { return LibAppStorage.appStorage().aaveVault; }
}
