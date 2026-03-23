// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/diamond/interfaces/IDiamondCut.sol";
import "../src/diamond/facets/ConfigFacet.sol";
import "../src/diamond/facets/InvestmentFacet.sol";
import "../src/diamond/initializers/DiamondInitV2.sol";

/// @title UpgradeV3 - 修复推荐奖 + 平级池 + 2代限制
/// @notice 升级内容:
///   1. 推荐奖最多解锁2代（代码逻辑修复）
///   2. 确保动态池分配正确: 推荐20% + 团队70% + 平级10%
///   3. 添加 sameLevelSharePercent getter 到 Diamond
///   4. 同步 InvestmentFacet (LibMemePlus 2代限制修复)
contract UpgradeV3 is Script {
    address constant DIAMOND = 0xB3197881Cd985bDd7D442F03d534FC37169e0C96;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. 部署新合约
        InvestmentFacet newInvestment = new InvestmentFacet();
        ConfigFacet newConfig = new ConfigFacet();
        DiamondInitV2 initV2 = new DiamondInitV2();
        console.log("New InvestmentFacet:", address(newInvestment));
        console.log("New ConfigFacet:", address(newConfig));
        console.log("DiamondInitV2:", address(initV2));

        // 2. 准备 diamondCut
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](2);

        // 2a. Replace: InvestmentFacet (含2代限制修复)
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(newInvestment),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getInvestmentSelectors()
        });

        // 2b. Add: sameLevelSharePercent getter (缺失的选择器)
        bytes4[] memory addSelectors = new bytes4[](1);
        addSelectors[0] = ConfigFacet.sameLevelSharePercent.selector;
        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(newConfig),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: addSelectors
        });

        // 3. 执行 diamondCut + DiamondInitV2 初始化
        IDiamondCut(DIAMOND).diamondCut(
            cuts,
            address(initV2),
            abi.encodeWithSelector(DiamondInitV2.init.selector)
        );
        console.log("[OK] diamondCut executed");

        // 4. 验证参数
        require(ConfigFacet(DIAMOND).referralGen1() == 5000, "referralGen1 != 5000");
        require(ConfigFacet(DIAMOND).referralGen2() == 5000, "referralGen2 != 5000");
        require(ConfigFacet(DIAMOND).referralGen3() == 0, "referralGen3 != 0");
        require(ConfigFacet(DIAMOND).referralSharePercent() == 2000, "referralSharePercent != 2000");
        require(ConfigFacet(DIAMOND).teamSharePercent() == 7000, "teamSharePercent != 7000");
        require(ConfigFacet(DIAMOND).sameLevelSharePercent() == 1000, "sameLevelSharePercent != 1000");
        require(ConfigFacet(DIAMOND).vLevelThreshold7() == 2_000_000e18, "vLevelThreshold7");
        require(ConfigFacet(DIAMOND).vLevelRate7() == 7000, "vLevelRate7");
        console.log("[OK] All parameters verified");

        vm.stopBroadcast();
    }

    function _getInvestmentSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](6);
        s[0] = InvestmentFacet.register.selector;
        s[1] = InvestmentFacet.invest.selector;
        s[2] = InvestmentFacet.settle.selector;
        s[3] = InvestmentFacet.claimDailyReturn.selector;
        s[4] = InvestmentFacet.batchClaimDailyReturn.selector;
        s[5] = InvestmentFacet.settleAndBatchClaim.selector;
    }
}
