// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/diamond/interfaces/IDiamondCut.sol";
import "../src/diamond/facets/DataCleanFacet.sol";

/// @title AddDataCleanFacet - 部署并添加 DataCleanFacet 到 Diamond
contract AddDataCleanFacet is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address diamond = 0xB3197881Cd985bDd7D442F03d534FC37169e0C96;

        vm.startBroadcast(deployerKey);

        DataCleanFacet cleanFacet = new DataCleanFacet();
        console.log("DataCleanFacet deployed:", address(cleanFacet));

        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = DataCleanFacet.purgeNonAdminData.selector;

        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](1);
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(cleanFacet),
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: selectors
        });

        IDiamondCut(diamond).diamondCut(cuts, address(0), "");
        console.log("DataCleanFacet added to Diamond");

        vm.stopBroadcast();
    }
}
