// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IDiamondCut.sol";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                  LibDiamond - ERC-2535 核心库                                ║
// ║                                                                              ║
// ║  ⚠️ 修改注意事项:                                                            ║
// ║  1. DiamondStorage 结构体遵循 APPEND-ONLY 规则（同 AppStorage）              ║
// ║  2. 此库管理 selector→facet 映射，是 Diamond 路由的基础                      ║
// ║  3. diamondCut() 是最核心的函数 — 慎重修改                                   ║
// ║  4. 修改此库后需重新部署 DiamondCutFacet（因为库代码内联编译）                ║
// ║  5. 不要修改 DIAMOND_STORAGE_POSITION 的值（会丢失所有已有映射）              ║
// ║  6. addFunction/removeFunction 中的 swap-and-pop 算法经过优化，不要随意改动   ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

/// @title LibDiamond - ERC-2535 Diamond Storage 与 Cut 逻辑
/// @dev 基于 Nick Mudge 的参考实现 (EIP-2535)
///      此库通过 internal 函数内联到使用它的合约中
library LibDiamond {
    /// @dev DiamondStorage 的存储位置 = keccak256("diamond.standard.diamond.storage")
    /// 与 AppStorage 使用不同的 slot，互不干扰
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");

    /// @dev 记录每个函数选择器对应的 facet 地址及其在选择器数组中的位置
    struct FacetAddressAndPosition {
        address facetAddress;                  // 该选择器路由到的 facet 合约地址
        uint96 functionSelectorPosition;       // 在 facetFunctionSelectors[facet].functionSelectors 数组中的索引
    }

    /// @dev 记录某个 facet 拥有的所有函数选择器
    struct FacetFunctionSelectors {
        bytes4[] functionSelectors;            // 该 facet 注册的所有选择器
        uint256 facetAddressPosition;          // 在 facetAddresses 数组中的索引（用于 swap-and-pop 删除）
    }

    /// @dev Diamond 核心存储 — 管理 selector↔facet 映射关系
    /// ⚠️ 此结构体也遵循 APPEND-ONLY 规则
    struct DiamondStorage {
        // selector → facet 地址 + 位置（路由查找用）
        mapping(bytes4 => FacetAddressAndPosition) selectorToFacetAndPosition;
        // facet 地址 → 该 facet 的所有选择器（diamondCut 管理用）
        mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
        // 所有已注册的 facet 地址（DiamondLoupe.facetAddresses() 返回此列表）
        address[] facetAddresses;
        // ERC-165 接口支持标记
        mapping(bytes4 => bool) supportedInterfaces;
        // Diamond 所有者（拥有 diamondCut 权限）
        address contractOwner;
    }

    /// @notice 获取 DiamondStorage 的 storage 引用
    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice 设置 Diamond 合约所有者
    function setContractOwner(address _newOwner) internal {
        DiamondStorage storage ds = diamondStorage();
        address previousOwner = ds.contractOwner;
        ds.contractOwner = _newOwner;
        emit OwnershipTransferred(previousOwner, _newOwner);
    }

    function contractOwner() internal view returns (address contractOwner_) {
        contractOwner_ = diamondStorage().contractOwner;
    }

    /// @notice 验证 msg.sender 是否为 Diamond owner
    function enforceIsContractOwner() internal view {
        require(msg.sender == diamondStorage().contractOwner, "LibDiamond: Must be contract owner");
    }

    event DiamondCut(IDiamondCut.FacetCut[] _diamondCut, address _init, bytes _calldata);

    // ╔══════════════════════════════════════════════════════════════════╗
    // ║  diamondCut - 添加/替换/移除函数选择器的核心入口                  ║
    // ║                                                                  ║
    // ║  调用方式:                                                        ║
    // ║  - Add:     将新函数选择器映射到新 facet（选择器不能已存在）       ║
    // ║  - Replace: 将已有选择器重新映射到新 facet（用于升级 facet）       ║
    // ║  - Remove:  移除函数选择器（facetAddress 必须为 address(0)）       ║
    // ║                                                                  ║
    // ║  _init + _calldata: 可选的初始化调用                              ║
    // ║  - 若 _init != address(0)，会 delegatecall _init._calldata       ║
    // ║  - 常用于初始化新 facet 需要的存储变量                             ║
    // ╚══════════════════════════════════════════════════════════════════╝

    /// @notice 执行 diamondCut 操作
    /// @param _diamondCut 要添加/替换/移除的 facet 和选择器数组
    /// @param _init 初始化合约地址（address(0) 表示不初始化）
    /// @param _calldata 初始化调用数据
    function diamondCut(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) internal {
        for (uint256 facetIndex; facetIndex < _diamondCut.length; facetIndex++) {
            IDiamondCut.FacetCutAction action = _diamondCut[facetIndex].action;
            if (action == IDiamondCut.FacetCutAction.Add) {
                addFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Replace) {
                replaceFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Remove) {
                removeFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else {
                revert("LibDiamond: Incorrect FacetCutAction");
            }
        }
        emit DiamondCut(_diamondCut, _init, _calldata);
        // 执行可选的初始化调用
        initializeDiamondCut(_init, _calldata);
    }

    /// @dev 添加新的函数选择器到指定 facet
    /// ⚠️ 选择器不能已经被其他 facet 注册（否则 revert）
    function addFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        require(_functionSelectors.length > 0, "LibDiamond: No selectors in facet to cut");
        DiamondStorage storage ds = diamondStorage();
        require(_facetAddress != address(0), "LibDiamond: Add facet can't be address(0)");
        uint96 selectorPosition = uint96(ds.facetFunctionSelectors[_facetAddress].functionSelectors.length);
        // 如果是第一次注册该 facet，将其加入 facetAddresses 列表
        if (selectorPosition == 0) {
            addFacet(ds, _facetAddress);
        }
        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            require(oldFacetAddress == address(0), "LibDiamond: Can't add function that already exists");
            addFunction(ds, selector, selectorPosition, _facetAddress);
            selectorPosition++;
        }
    }

    /// @dev 替换已有选择器的 facet 映射（升级 facet 时使用）
    /// ⚠️ 不能用同一个 facet 地址替换自己
    function replaceFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        require(_functionSelectors.length > 0, "LibDiamond: No selectors in facet to cut");
        DiamondStorage storage ds = diamondStorage();
        require(_facetAddress != address(0), "LibDiamond: Add facet can't be address(0)");
        uint96 selectorPosition = uint96(ds.facetFunctionSelectors[_facetAddress].functionSelectors.length);
        if (selectorPosition == 0) {
            addFacet(ds, _facetAddress);
        }
        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            require(oldFacetAddress != _facetAddress, "LibDiamond: Can't replace function with same function");
            // 先从旧 facet 移除，再添加到新 facet
            removeFunction(ds, oldFacetAddress, selector);
            addFunction(ds, selector, selectorPosition, _facetAddress);
            selectorPosition++;
        }
    }

    /// @dev 移除函数选择器
    /// ⚠️ facetAddress 参数必须为 address(0)（ERC-2535 规范要求）
    function removeFunctions(address _facetAddress, bytes4[] memory _functionSelectors) internal {
        require(_functionSelectors.length > 0, "LibDiamond: No selectors in facet to cut");
        DiamondStorage storage ds = diamondStorage();
        require(_facetAddress == address(0), "LibDiamond: Remove facet address must be address(0)");
        for (uint256 selectorIndex; selectorIndex < _functionSelectors.length; selectorIndex++) {
            bytes4 selector = _functionSelectors[selectorIndex];
            address oldFacetAddress = ds.selectorToFacetAndPosition[selector].facetAddress;
            removeFunction(ds, oldFacetAddress, selector);
        }
    }

    /// @dev 将新 facet 地址注册到 facetAddresses 列表
    function addFacet(DiamondStorage storage ds, address _facetAddress) internal {
        // 验证 facet 地址有合约代码（防止指向 EOA）
        enforceHasContractCode(_facetAddress, "LibDiamond: New facet has no code");
        ds.facetFunctionSelectors[_facetAddress].facetAddressPosition = ds.facetAddresses.length;
        ds.facetAddresses.push(_facetAddress);
    }

    /// @dev 注册单个函数选择器到 facet
    function addFunction(
        DiamondStorage storage ds,
        bytes4 _selector,
        uint96 _selectorPosition,
        address _facetAddress
    ) internal {
        // 建立 selector → facet 的正向映射
        ds.selectorToFacetAndPosition[_selector].functionSelectorPosition = _selectorPosition;
        ds.selectorToFacetAndPosition[_selector].facetAddress = _facetAddress;
        // 建立 facet → selectors 的反向映射
        ds.facetFunctionSelectors[_facetAddress].functionSelectors.push(_selector);
    }

    /// @dev 从 facet 移除单个函数选择器
    /// 使用 swap-and-pop 算法保持数组紧凑（O(1) 删除）
    function removeFunction(
        DiamondStorage storage ds,
        address _facetAddress,
        bytes4 _selector
    ) internal {
        require(_facetAddress != address(0), "LibDiamond: Can't remove function that doesn't exist");
        // 定义在 Diamond 本体中的函数（constructor 中直接定义的）不可移除
        require(_facetAddress != address(this), "LibDiamond: Can't remove immutable function");

        // === Swap-and-Pop: 用最后一个选择器覆盖要删除的位置 ===
        uint256 selectorPosition = ds.selectorToFacetAndPosition[_selector].functionSelectorPosition;
        uint256 lastSelectorPosition = ds.facetFunctionSelectors[_facetAddress].functionSelectors.length - 1;
        // 如果要删除的不是最后一个，先做交换
        if (selectorPosition != lastSelectorPosition) {
            bytes4 lastSelector = ds.facetFunctionSelectors[_facetAddress].functionSelectors[lastSelectorPosition];
            ds.facetFunctionSelectors[_facetAddress].functionSelectors[selectorPosition] = lastSelector;
            ds.selectorToFacetAndPosition[lastSelector].functionSelectorPosition = uint96(selectorPosition);
        }
        // 删除最后一个元素
        ds.facetFunctionSelectors[_facetAddress].functionSelectors.pop();
        // 清除 selector → facet 映射
        delete ds.selectorToFacetAndPosition[_selector];

        // 如果该 facet 已无任何选择器，从 facetAddresses 列表中移除
        if (lastSelectorPosition == 0) {
            // 同样用 swap-and-pop 算法
            uint256 lastFacetAddressPosition = ds.facetAddresses.length - 1;
            uint256 facetAddressPosition = ds.facetFunctionSelectors[_facetAddress].facetAddressPosition;
            if (facetAddressPosition != lastFacetAddressPosition) {
                address lastFacetAddress = ds.facetAddresses[lastFacetAddressPosition];
                ds.facetAddresses[facetAddressPosition] = lastFacetAddress;
                ds.facetFunctionSelectors[lastFacetAddress].facetAddressPosition = facetAddressPosition;
            }
            ds.facetAddresses.pop();
            delete ds.facetFunctionSelectors[_facetAddress].facetAddressPosition;
        }
    }

    /// @dev 在 diamondCut 完成后执行可选的初始化调用
    /// 通过 delegatecall 调用 _init 合约的 _calldata 函数
    /// 常用于设置新 facet 需要的初始存储值
    function initializeDiamondCut(address _init, bytes memory _calldata) internal {
        if (_init == address(0)) {
            return;
        }
        enforceHasContractCode(_init, "LibDiamond: _init address has no code");
        // delegatecall: _init 的代码在 Diamond 的存储上下文中执行
        (bool success, bytes memory error) = _init.delegatecall(_calldata);
        if (!success) {
            if (error.length > 0) {
                assembly {
                    let returndata_size := mload(error)
                    revert(add(32, error), returndata_size)
                }
            } else {
                revert("LibDiamond: _init function reverted");
            }
        }
    }

    /// @dev 验证地址是否包含合约代码（extcodesize > 0）
    function enforceHasContractCode(address _contract, string memory _errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        require(contractSize > 0, _errorMessage);
    }
}
