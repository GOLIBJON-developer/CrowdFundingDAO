// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/*//////////////////////////////////////////////////////////////
                            IMPORTS
//////////////////////////////////////////////////////////////*/
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CrowdfundingCampaign} from "./CrowdfundingCampaign.sol";
import {IFundToken} from "./interfaces/IFundToken.sol";

/*//////////////////////////////////////////////////////////////
                DATA FLOW — CAMPAIGN FACTORY
//////////////////////////////////////////////////////////////*/
//
//  DEPLOYMENT ORDER:
//  1. Deploy FundToken(deployer) — deployer gets DEFAULT_ADMIN_ROLE
//  2. Deploy CampaignFactory(fundToken, deployer, feeRecipient, feeBps)
//  3. fundToken.grantRole(DEFAULT_ADMIN_ROLE, factory) — factory becomes admin
//  4. fundToken.renounceRole(DEFAULT_ADMIN_ROLE, deployer) — optional: decentralize
//  5. Optionally: transfer DAO governance to Governor + Timelock
//
//  createCampaign() FLOW:
//  [User] ──createCampaign(goal, deadline, title, desc)──► [Factory]
//                                                                │
//                                             new CrowdfundingCampaign(...)
//                                                                │
//                                          fundToken.grantCampaignRoles(campaign)
//                                                                │
//                                               s_campaigns.push(campaign)
//                                               s_isCampaign[campaign] = true
//                                               s_creatorCampaigns[creator].push(campaign)
//                                                                │
//                                                   emit CampaignCreated(...)
//
//  FACTORY CONTROLS:
//  - Platform fee rate (changeable by OPERATOR_ROLE)
//  - Fee recipient (changeable by OPERATOR_ROLE)
//  - Campaign max duration (safety guard)
//  - Pause factory (pause all new campaign creation)
//  - Cancel any campaign (governance emergency)

/// @title CampaignFactory
/// @author Crowdfunding DAO
/// @notice Factory for deploying CrowdfundingCampaign contracts.
///         Also holds the DEFAULT_ADMIN_ROLE on FundToken to grant minting
///         rights to newly deployed campaigns.
/// @dev AccessControl: DEFAULT_ADMIN_ROLE = ultimate authority (DAO timelock eventually)
///                     OPERATOR_ROLE = day-to-day operations (multisig or team)
contract CampaignFactory is AccessControl, Pausable, ReentrancyGuard {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error CampaignFactory__InvalidGoal();
    error CampaignFactory__InvalidDeadline();
    error CampaignFactory__DeadlineTooFar();
    error CampaignFactory__NotACampaign();
    error CampaignFactory__InvalidFee();
    error CampaignFactory__ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                                ROLES
    //////////////////////////////////////////////////////////////*/
    /// @notice Operational role — can update fee, pause campaigns, etc.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /*//////////////////////////////////////////////////////////////
                         STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    // Immutable — set once at deployment
    IFundToken public immutable i_fundToken;

    // Slot 0: s_platformFeeBps(2) + s_maxDurationDays(2) = 4 bytes (28 wasted)
    uint16 public s_platformFeeBps; // e.g. 250 = 2.5%
    uint16 public s_maxDurationDays; // max campaign duration (e.g. 365 days)

    // Slot 1: s_feeRecipient (address = 20 bytes)
    address public s_feeRecipient;

    // Dynamic arrays & mappings
    address[] private s_campaigns;
    mapping(address => bool) public s_isCampaign;
    mapping(address => address[]) public s_creatorCampaigns;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event CampaignCreated(
        address indexed campaign, address indexed creator, uint256 goal, uint48 deadline, string title
    );
    event PlatformFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);
    event CampaignCancelledByFactory(address indexed campaign, address indexed by);
    event MaxDurationUpdated(uint16 newDays);

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    /// @param fundToken  Address of the deployed FundToken contract
    /// @param admin  Address granted DEFAULT_ADMIN_ROLE (multisig or deployer)
    /// @param feeRecipient  Where platform fees are sent
    /// @param platformFeeBps  Platform fee in basis points (max 1000 = 10%)
    constructor(address fundToken, address admin, address feeRecipient, uint16 platformFeeBps) {
        if (fundToken == address(0) || admin == address(0) || feeRecipient == address(0)) {
            revert CampaignFactory__ZeroAddress();
        }
        if (platformFeeBps > 1000) revert CampaignFactory__InvalidFee(); // max 10%

        i_fundToken = IFundToken(fundToken);
        s_feeRecipient = feeRecipient;
        s_platformFeeBps = platformFeeBps;
        s_maxDurationDays = 365; // default: max 1 year campaigns

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /*//////////////////////////////////////////////////////////////
                       CORE EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy a new CrowdfundingCampaign
    /// @dev  Creates a new contract, grants it minting roles on FundToken, records it.
    ///       nonReentrant: prevents reentrant campaign creation (edge case with malicious titles)
    ///       whenNotPaused: factory can be paused to stop new campaign creation
    /// @param goal   Funding goal in wei
    /// @param deadline  Unix timestamp when campaign ends (must be future, within maxDuration)
    /// @param title  Short campaign title (stored on-chain)
    /// @param description  Campaign description (consider storing IPFS hash for long text)
    /// @return campaign  Address of the newly deployed campaign contract
    function createCampaign(uint256 goal, uint48 deadline, string calldata title, string calldata description)
        external
        whenNotPaused
        nonReentrant
        returns (address campaign)
    {
        // ── CHECKS ──────────────────────────────────────────
        if (goal == 0) revert CampaignFactory__InvalidGoal();
        if (deadline <= block.timestamp) revert CampaignFactory__InvalidDeadline();

        // Guard against unreasonably long campaigns
        uint256 maxDeadline = block.timestamp + (uint256(s_maxDurationDays) * 1 days);
        if (deadline > maxDeadline) revert CampaignFactory__DeadlineTooFar();

        // ── EFFECTS ─────────────────────────────────────────
        // Deploy new campaign contract — msg.sender becomes the creator
        campaign = address(
            new CrowdfundingCampaign(
                msg.sender, // creator
                address(this), // factory
                address(i_fundToken),
                goal,
                deadline,
                s_platformFeeBps, // snapshot current fee at creation time
                title,
                description
            )
        );

        // Record campaign
        s_campaigns.push(campaign);
        s_isCampaign[campaign] = true;
        s_creatorCampaigns[msg.sender].push(campaign);

        emit CampaignCreated(campaign, msg.sender, goal, deadline, title);

        // ── INTERACTIONS ─────────────────────────────────────
        // Grant this campaign the right to mint/burn FUND tokens
        // Factory must hold DEFAULT_ADMIN_ROLE on FundToken for this to work
        i_fundToken.grantCampaignRoles(campaign);
    }

    /*//////////////////////////////////////////////////////////////
                      GOVERNANCE/OPERATOR FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Called by a campaign after finalize() to revoke its token roles.
    /// @dev Only registered campaigns can call this (checked via s_isCampaign).
    ///      Factory holds DEFAULT_ADMIN_ROLE on FundToken, so it's the only one
    ///      that can revoke. Campaign cannot call FundToken directly.
    ///      SUCCESSFUL → revoke MINTER + BURNER (no refunds needed after success)
    ///      FAILED     → revoke MINTER only (keep BURNER so refunds still work)
    /// @param successful  Whether the campaign succeeded or failed
    function onCampaignFinalized(bool successful) external {
        if (!s_isCampaign[msg.sender]) revert CampaignFactory__NotACampaign();
        if (successful) {
            i_fundToken.revokeCampaignRoles(msg.sender);
        } else {
            i_fundToken.revokeMinterRole(msg.sender);
        }
    }

    /// @notice Emergency cancel a campaign (DAO governance or operator)
    /// @dev Calls campaign.cancel() which transitions it to CANCELLED state
    ///      Contributors can then refund. Used for fraudulent or rule-violating campaigns.
    function cancelCampaign(address campaign) external onlyRole(OPERATOR_ROLE) {
        if (!s_isCampaign[campaign]) revert CampaignFactory__NotACampaign();
        CrowdfundingCampaign(payable(campaign)).cancel();
        emit CampaignCancelledByFactory(campaign, msg.sender);
    }

    /// @notice Pause a specific campaign (emergency stop for contributions)
    function pauseCampaign(address campaign) external onlyRole(OPERATOR_ROLE) {
        if (!s_isCampaign[campaign]) revert CampaignFactory__NotACampaign();
        CrowdfundingCampaign(payable(campaign)).pause();
    }

    /// @notice Unpause a campaign
    function unpauseCampaign(address campaign) external onlyRole(OPERATOR_ROLE) {
        if (!s_isCampaign[campaign]) revert CampaignFactory__NotACampaign();
        CrowdfundingCampaign(payable(campaign)).unpause();
    }

    /// @notice Revoke token roles from a campaign (called after finalization)
    /// @dev Normally called automatically in finalize(). This is a manual override.
    function revokeCampaignTokenRoles(address campaign) external onlyRole(OPERATOR_ROLE) {
        if (!s_isCampaign[campaign]) revert CampaignFactory__NotACampaign();
        i_fundToken.revokeCampaignRoles(campaign);
    }

    /// @notice Pause all new campaign creation
    function pauseFactory() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    /// @notice Unpause campaign creation
    function unpauseFactory() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Update the platform fee (max 10%)
    function setPlatformFee(uint16 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps > 1000) revert CampaignFactory__InvalidFee();
        emit PlatformFeeUpdated(s_platformFeeBps, newFeeBps);
        s_platformFeeBps = newFeeBps;
    }

    /// @notice Update the fee recipient address
    function setFeeRecipient(address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newRecipient == address(0)) revert CampaignFactory__ZeroAddress();
        emit FeeRecipientUpdated(s_feeRecipient, newRecipient);
        s_feeRecipient = newRecipient;
    }

    /// @notice Update maximum campaign duration
    function setMaxDuration(uint16 newDays) external onlyRole(DEFAULT_ADMIN_ROLE) {
        s_maxDurationDays = newDays;
        emit MaxDurationUpdated(newDays);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get all campaign addresses
    function getCampaigns() external view returns (address[] memory) {
        return s_campaigns;
    }

    /// @notice Get total number of campaigns
    function getCampaignCount() external view returns (uint256) {
        return s_campaigns.length;
    }

    /// @notice Get campaigns created by a specific address
    function getCampaignsByCreator(address creator) external view returns (address[] memory) {
        return s_creatorCampaigns[creator];
    }

    /// @notice Paginated campaign list (for frontends with many campaigns)
    /// @param offset  Start index
    /// @param limit   Max items to return
    function getCampaignsPaginated(uint256 offset, uint256 limit) external view returns (address[] memory result) {
        uint256 total = s_campaigns.length;
        if (offset >= total) return new address[](0);

        uint256 end = offset + limit;
        if (end > total) end = total;

        result = new address[](end - offset);
        for (uint256 i = offset; i < end;) {
            result[i - offset] = s_campaigns[i];
            unchecked {
                ++i; // safe: i < end <= total
            }
        }
    }
}
