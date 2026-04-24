// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IFundToken} from "./interfaces/IFundToken.sol";

/// @title FundToken
/// @notice ERC20Votes governance token. Minted 1:1 (wei) on contribution. Burned on refund.
/// @dev Role hierarchy:
///      DEFAULT_ADMIN_ROLE → CampaignFactory (grants/revokes campaign roles)
///      MINTER_ROLE        → Each CrowdfundingCampaign (granted by factory at deploy)
///      BURNER_ROLE        → Each CrowdfundingCampaign (granted by factory at deploy)
contract FundToken is ERC20, ERC20Permit, ERC20Votes, AccessControl, IFundToken {
    /*//////////////////////////////////////////////////////////////
                               ERRORS
    //////////////////////////////////////////////////////////////*/
    error FundToken__ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                               ROLES
    //////////////////////////////////////////////////////////////*/
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address admin) ERC20("FundToken", "FUND") ERC20Permit("FundToken") {
        if (admin == address(0)) revert FundToken__ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /*//////////////////////////////////////////////////////////////
                          EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint FUND tokens 1:1 with ETH contributed. Only MINTER_ROLE (campaigns).
    /// @dev Auto self-delegates on first receive so voting power is immediately active.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        if (delegates(to) == address(0)) {
            _delegate(to, to);
        }
        _mint(to, amount);
    }

    /// @notice Burn FUND tokens on refund. Only BURNER_ROLE (campaigns).
    /// @dev Bypasses ERC20 allowance — campaign is trusted to call correctly.
    function burnFrom(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    /// @notice Grant MINTER + BURNER roles to a new campaign. Only DEFAULT_ADMIN (factory).
    function grantCampaignRoles(address campaign) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, campaign);
        _grantRole(BURNER_ROLE, campaign);
        emit MinterGranted(campaign);
    }

    /// @notice Revoke MINTER + BURNER from a SUCCESSFUL campaign. Only DEFAULT_ADMIN (factory).
    function revokeCampaignRoles(address campaign) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, campaign);
        _revokeRole(BURNER_ROLE, campaign);
        emit MinterRevoked(campaign);
    }

    /// @notice Revoke only MINTER from a FAILED campaign (keep BURNER for refunds). Only DEFAULT_ADMIN.
    function revokeMinterRole(address campaign) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(MINTER_ROLE, campaign);
    }

    /*//////////////////////////////////////////////////////////////
                     CLOCK — TIMESTAMP MODE (OZ v5)
    //////////////////////////////////////////////////////////////*/
    // WHY: GovernorSettings votingDelay/votingPeriod are interpreted in "clock units".
    // Default clock = block number → "1 days" = 86400 blocks ≈ 12 days real time.
    // With timestamp clock → "1 days" = 86400 seconds = 1 real day. Correct.
    // BOTH FundToken AND CrowdfundingGovernor must use the same mode.

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    /*//////////////////////////////////////////////////////////////
                       REQUIRED OZ v5 OVERRIDES
    //////////////////////////////////////////////////////////////*/
    // ERC20 and ERC20Votes both define _update() — explicit resolution required.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    // ERC20Permit and Nonces both expose nonces() — explicit resolution required.
    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
