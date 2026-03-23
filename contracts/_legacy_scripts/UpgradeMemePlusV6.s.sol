// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../src/core/MemePlus.sol";

contract UpgradeMemePlusV6 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address proxy = vm.envAddress("MEMEPLUS_PROXY");
        address usdt = vm.envAddress("USDT_ADDRESS");
        address swapperProxy = vm.envAddress("PANCAKE_SWAPPER_PROXY");
        address mmToken = vm.envAddress("MM_TOKEN_ADDRESS");
        address bckToken = vm.envAddress("BCK_TOKEN_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        MemePlus newImpl = new MemePlus(usdt, swapperProxy, mmToken, bckToken);
        console.log("New impl:", address(newImpl));

        bytes memory initData = abi.encodeCall(MemePlus.initializeV6, ());
        MemePlus(proxy).upgradeToAndCall(address(newImpl), initData);

        console.log("Upgraded to V6 DSR");
        console.log("VERSION:", MemePlus(proxy).VERSION());
        console.log("Genesis:", MemePlus(proxy).genesisTimestamp());

        vm.stopBroadcast();
    }
}
