// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/core/MemePlus.sol";
import "../src/external/PancakeSwapper.sol";

/**
 * @title DeployProxy
 * @notice Deploy MemePlus, PancakeSwapper behind UUPS proxies (mainnet).
 *
 * Env vars:
 *   DEPLOYER_PRIVATE_KEY      - deployer/owner private key
 *   USDT_ADDRESS              - USDT token address
 *   MM_TOKEN_ADDRESS          - MM token address
 *   BCK_TOKEN_ADDRESS         - BCK token address
 *   PANCAKE_ROUTER_ADDRESS    - PancakeSwap router address
 *   ADMIN_ADDRESS             - admin wallet to be added
 */
contract DeployProxy is Script {
    address constant RECEIVER_WALLET = 0x63769e7288Ae3f9524e5159C19203BE5eBB1f0F7;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address usdt = vm.envAddress("USDT_ADDRESS");
        address mmToken = vm.envAddress("MM_TOKEN_ADDRESS");
        address bckToken = vm.envAddress("BCK_TOKEN_ADDRESS");
        address pancakeRouter = vm.envAddress("PANCAKE_ROUTER_ADDRESS");
        address feeCollector = vm.envOr("FEE_COLLECTOR", deployer);
        address adminAddress = vm.envAddress("ADMIN_ADDRESS");

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
            abi.encodeCall(MemePlus.initialize, (deployer, feeCollector, RECEIVER_WALLET))
        );
        MemePlus mp = MemePlus(address(mpProxy));
        console.log("MemePlus impl:", address(mpImpl));
        console.log("MemePlus proxy:", address(mpProxy));

        // 3. Authorize MemePlus proxy on PancakeSwapper
        swapper.setAuthorized(address(mpProxy), true);

        // 4. Add deployer as admin (sets isAdmin mapping for backward compat)
        mp.addAdmin(deployer);
        console.log("Deployer added as admin:", deployer);

        // 5. Add additional admin wallet
        mp.addAdmin(adminAddress);
        console.log("Admin added:", adminAddress);

        console.log("---");
        console.log("Deployment complete!");
        console.log("PancakeSwapper proxy:", address(swapperProxy));
        console.log("MemePlus proxy:", address(mpProxy));
        console.log("Fee Collector:", feeCollector);
        console.log("Receiver Wallet:", RECEIVER_WALLET);
        console.log("Owner (upgrade authority):", deployer);

        vm.stopBroadcast();
    }
}
