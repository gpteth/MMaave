// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/diamond/interfaces/IDiamondCut.sol";
import "../src/diamond/facets/DataCleanFacet.sol";

/// @title PurgeDiamond - 部署 DataCleanFacet 并执行清理
/// @notice 流程: 部署 → diamondCut(Add) → purgeNonAdminData() → diamondCut(Remove)
contract PurgeDiamond is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address diamond = 0xB3197881Cd985bDd7D442F03d534FC37169e0C96;

        vm.startBroadcast(deployerKey);

        // 1. 部署 DataCleanFacet
        DataCleanFacet cleanFacet = new DataCleanFacet();
        console.log("DataCleanFacet deployed:", address(cleanFacet));

        // 2. 通过 diamondCut 添加 purgeNonAdminData 函数
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = DataCleanFacet.purgeNonAdminData.selector;

        IDiamondCut.FacetCut[] memory addCut = new IDiamondCut.FacetCut[](1);
        addCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(cleanFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });

        IDiamondCut(diamond).diamondCut(addCut, address(0), "");
        console.log("DataCleanFacet added to Diamond");

        // 3. 执行清理
        DataCleanFacet(diamond).purgeNonAdminData();
        console.log("purgeNonAdminData() executed");

        // 4. 移除 DataCleanFacet（一次性工具，用完即弃）
        IDiamondCut.FacetCut[] memory removeCut = new IDiamondCut.FacetCut[](1);
        removeCut[0] = IDiamondCut.FacetCut({
            facetAddress: address(0),
            action: IDiamondCut.FacetCutAction.Remove,
            functionSelectors: selectors
        });

        IDiamondCut(diamond).diamondCut(removeCut, address(0), "");
        console.log("DataCleanFacet removed from Diamond");

        console.log("--- Purge complete! ---");

        vm.stopBroadcast();
    }
}
