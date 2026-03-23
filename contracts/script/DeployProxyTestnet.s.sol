// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/MemePlus.sol";
import "../src/external/PancakeSwapper.sol";

/**
 * @title DeployProxyTestnet
 * @notice Deploy MemePlus behind UUPS proxies on BSC Testnet.
 */
contract DeployProxyTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address usdt = vm.envAddress("USDT_ADDRESS");
        address mmToken = vm.envAddress("MM_TOKEN_ADDRESS");
        address bckToken = vm.envAddress("BCK_TOKEN_ADDRESS");
        address feeCollector = vm.envOr("FEE_COLLECTOR", deployer);
        address receiverWallet = 0x63769e7288Ae3f9524e5159C19203BE5eBB1f0F7;
        address pancakeRouter = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy PancakeSwapper impl + proxy
        PancakeSwapper swapperImpl = new PancakeSwapper(pancakeRouter, usdt, mmToken);
        ERC1967Proxy swapperProxy = new ERC1967Proxy(
            address(swapperImpl),
            abi.encodeCall(PancakeSwapper.initialize, (deployer))
        );
        PancakeSwapper swapper = PancakeSwapper(address(swapperProxy));
        console.log("PancakeSwapper impl:", address(swapperImpl));
        console.log("PancakeSwapper proxy:", address(swapperProxy));

        // 2. Deploy MemePlus impl + proxy
        MemePlus mpImpl = new MemePlus(usdt, address(swapperProxy), mmToken, bckToken);
        ERC1967Proxy mpProxy = new ERC1967Proxy(
            address(mpImpl),
            abi.encodeCall(MemePlus.initialize, (deployer, feeCollector, receiverWallet))
        );
        console.log("MemePlus impl:", address(mpImpl));
        console.log("MemePlus proxy:", address(mpProxy));

        // 3. Authorize MemePlus proxy
        swapper.setAuthorized(address(mpProxy), true);

        console.log("---");
        console.log("Deployment complete!");
        console.log("PancakeSwapper proxy:", address(swapperProxy));
        console.log("MemePlus proxy:", address(mpProxy));
        console.log("Fee Collector:", feeCollector);
        console.log("Receiver Wallet:", receiverWallet);

        vm.stopBroadcast();
    }
}
