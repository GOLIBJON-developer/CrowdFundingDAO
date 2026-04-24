// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";

/// @title HelperConfig
/// @notice Network-specific configuration for deployment scripts.
/// @dev Cyfrin-style HelperConfig.
///
///      WHY NO deployerKey?
///      ───────────────────
///      Private keys in config = security risk + inflexible.
///      Instead we use `cast wallet` (encrypted keystores) via CLI --account flag.
///      DeployAll calls vm.startBroadcast() with no args → forge uses --account wallet.
///
///      SETUP (one time):
///        # Import Anvil default key (local dev)
///        cast wallet import anvil0 --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
///
///        # Import your real key (testnet/mainnet)
///        cast wallet import mykey --interactive   # prompts for key, encrypts it
///
///      BUG NOTE — why not `public` struct?
///      ─────────────────────────────────────
///      Solidity generates a TUPLE getter for `public` structs, not a struct getter.
///      Calling `helperConfig.activeNetworkConfig()` returns 4 separate values,
///      not a NetworkConfig struct — causing "Different number of components" error.
///      Fix: use `internal` storage + explicit `getActiveNetworkConfig()` getter.

contract HelperConfig is Script {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error HelperConfig__InvalidChainId(uint256 chainId);

    /*//////////////////////////////////////////////////////////////
                                TYPES
    //////////////////////////////////////////////////////////////*/
    struct NetworkConfig {
        address admin; // Gets DEFAULT_ADMIN_ROLE on Factory + FundToken
        address feeRecipient; // Where platform fees are sent
        uint16 platformFeeBps; // Fee in basis points (250 = 2.5%, max 1000 = 10%)
    }

    /*//////////////////////////////////////////////////////////////
                              CHAIN IDs
    //////////////////////////////////////////////////////////////*/
    uint256 constant SEPOLIA_CHAIN_ID = 11155111;
    uint256 constant MAINNET_CHAIN_ID = 1;
    uint256 constant LOCAL_CHAIN_ID = 31337;

    /*//////////////////////////////////////////////////////////////
                          ANVIL DEFAULT ADDRESS
    //////////////////////////////////////////////////////////////*/
    address constant ANVIL_ACCOUNT_0 = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    /*//////////////////////////////////////////////////////////////
                           STORAGE + GETTER
    //////////////////////////////////////////////////////////////*/
    NetworkConfig internal s_activeConfig;

    /// @notice Returns the active NetworkConfig as a proper struct (not a tuple).
    function getActiveNetworkConfig() external view returns (NetworkConfig memory) {
        return s_activeConfig;
    }

    constructor() {
        if (block.chainid == SEPOLIA_CHAIN_ID) {
            s_activeConfig = getSepoliaConfig();
        } else if (block.chainid == MAINNET_CHAIN_ID) {
            s_activeConfig = getMainnetConfig();
        } else if (block.chainid == LOCAL_CHAIN_ID) {
            s_activeConfig = getAnvilConfig();
        } else {
            revert HelperConfig__InvalidChainId(block.chainid);
        }
    }

    /*//////////////////////////////////////////////////////////////
                       NETWORK CONFIGURATIONS
    //////////////////////////////////////////////////////////////*/

    function getAnvilConfig() public pure returns (NetworkConfig memory) {
        return NetworkConfig({admin: ANVIL_ACCOUNT_0, feeRecipient: ANVIL_ACCOUNT_0, platformFeeBps: 250});
    }

    function getSepoliaConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            admin: vm.envAddress("ADMIN_ADDRESS"),
            feeRecipient: vm.envAddress("FEE_RECIPIENT_ADDRESS"),
            platformFeeBps: 250
        });
    }

    function getMainnetConfig() public view returns (NetworkConfig memory) {
        return NetworkConfig({
            admin: vm.envAddress("ADMIN_ADDRESS"),
            feeRecipient: vm.envAddress("FEE_RECIPIENT_ADDRESS"),
            platformFeeBps: 250
        });
    }
}
