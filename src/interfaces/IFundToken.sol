// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IFundToken
/// @notice Interface for the FundToken ERC-20 governance token
interface IFundToken {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error FundToken__Unauthorized();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    event MinterGranted(address indexed campaign);
    event MinterRevoked(address indexed campaign);

    /*//////////////////////////////////////////////////////////////
                           EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint FUND tokens to a contributor
    /// @dev Only MINTER_ROLE can call this
    /// @param to  Recipient address
    /// @param amount  Amount in wei (1:1 with ETH contributed)
    function mint(address to, uint256 amount) external;

    /// @notice Burn FUND tokens from a contributor (on refund)
    /// @dev Only BURNER_ROLE can call this — bypasses allowance check
    /// @param from  Address to burn from
    /// @param amount  Amount to burn
    function burnFrom(address from, uint256 amount) external;

    /// @notice Grant MINTER_ROLE + BURNER_ROLE to a deployed campaign
    /// @dev Only DEFAULT_ADMIN_ROLE (Factory) can call this
    /// @param campaign  Campaign contract address
    function grantCampaignRoles(address campaign) external;

    /// @notice Revoke MINTER_ROLE + BURNER_ROLE from a campaign (SUCCESSFUL — no refunds needed)
    function revokeCampaignRoles(address campaign) external;

    /// @notice Revoke only MINTER_ROLE — keeps BURNER for FAILED campaign refunds
    function revokeMinterRole(address campaign) external;

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function MINTER_ROLE() external view returns (bytes32);
    function BURNER_ROLE() external view returns (bytes32);
}
