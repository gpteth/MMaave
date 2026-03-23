// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMemePlus {
    function invest(uint256 amount, address referrer) external;
    function isMemberRegistered(address user) external view returns (bool);
    function minInvestment() external view returns (uint256);
}

contract TestInvest is Script {
    address constant MEMEPLUS = 0x48903F20BDA637365B4C749cf04e6DA230430449;
    address constant USDT    = 0xa76480DeA857aA9FDb1b93C95CCD4258e38BF062;
    address constant ZERO    = address(0);

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address me = vm.addr(pk);

        uint256 amount = 100e18;

        console.log("Investor:", me);
        console.log("USDT balance:", IERC20(USDT).balanceOf(me));
        console.log("USDT allowance:", IERC20(USDT).allowance(me, MEMEPLUS));
        console.log("Is registered:", IMemePlus(MEMEPLUS).isMemberRegistered(me));
        console.log("Min investment:", IMemePlus(MEMEPLUS).minInvestment());

        vm.startBroadcast(pk);

        // Approve if needed
        uint256 allowance = IERC20(USDT).allowance(me, MEMEPLUS);
        if (allowance < amount) {
            IERC20(USDT).approve(MEMEPLUS, amount);
            console.log("Approved 100 USDT");
        }

        // Invest 100 USDT, no referrer
        IMemePlus(MEMEPLUS).invest(amount, ZERO);
        console.log("Invested 100 USDT successfully");

        vm.stopBroadcast();
    }
}
