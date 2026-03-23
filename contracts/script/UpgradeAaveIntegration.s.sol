// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/diamond/interfaces/IDiamondCut.sol";
import "../src/diamond/facets/InvestmentFacet.sol";
import "../src/diamond/facets/WithdrawFacet.sol";
import "../src/diamond/facets/ConfigFacet.sol";

/// @title UpgradeAaveIntegration - 集成 Aave: 入金 supply / 出金 withdraw
/// @notice 升级 3 个 facet:
///   1. InvestmentFacet: invest() USDT → AaveVault → Aave supply
///   2. WithdrawFacet: withdraw() AaveVault → Aave withdraw → user
///   3. ConfigFacet: 新增 setAaveVault() + aaveVault() getter
contract UpgradeAaveIntegration is Script {
    address constant DIAMOND = 0xB3197881Cd985bDd7D442F03d534FC37169e0C96;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address aaveVaultProxy = vm.envAddress("AAVE_VAULT_PROXY");

        vm.startBroadcast(deployerKey);

        // 1. 部署新 facets
        InvestmentFacet newInvestFacet = new InvestmentFacet();
        console.log("New InvestmentFacet:", address(newInvestFacet));

        WithdrawFacet newWithdrawFacet = new WithdrawFacet();
        console.log("New WithdrawFacet:", address(newWithdrawFacet));

        ConfigFacet newConfigFacet = new ConfigFacet();
        console.log("New ConfigFacet:", address(newConfigFacet));

        // 2. diamondCut
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](3);

        // Replace InvestmentFacet (7 个选择器)
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(newInvestFacet),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getInvestmentSelectors()
        });

        // Replace WithdrawFacet (2 个选择器)
        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(newWithdrawFacet),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getWithdrawSelectors()
        });

        // Replace ConfigFacet 选择器: setAaveVault + aaveVault
        // (如已 Add 则 Replace，如未注册则改回 Add)
        cuts[2] = IDiamondCut.FacetCut({
            facetAddress: address(newConfigFacet),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: _getConfigNewSelectors()
        });

        IDiamondCut(DIAMOND).diamondCut(cuts, address(0), "");
        console.log("diamondCut done - facets upgraded");

        // 3. 设置 AaveVault 地址到 Diamond Storage
        ConfigFacet(DIAMOND).setAaveVault(aaveVaultProxy);
        console.log("AaveVault set to:", aaveVaultProxy);

        vm.stopBroadcast();
    }

    function _getInvestmentSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](7);
        s[0] = InvestmentFacet.register.selector;
        s[1] = InvestmentFacet.invest.selector;
        s[2] = InvestmentFacet.investFromBalance.selector;
        s[3] = InvestmentFacet.settle.selector;
        s[4] = InvestmentFacet.claimDailyReturn.selector;
        s[5] = InvestmentFacet.batchClaimDailyReturn.selector;
        s[6] = InvestmentFacet.settleAndBatchClaim.selector;
    }

    function _getWithdrawSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = WithdrawFacet.withdraw.selector;
        s[1] = WithdrawFacet.rescueTokens.selector;
    }

    function _getConfigNewSelectors() internal pure returns (bytes4[] memory s) {
        s = new bytes4[](2);
        s[0] = ConfigFacet.setAaveVault.selector;
        s[1] = ConfigFacet.aaveVault.selector;
    }
}
