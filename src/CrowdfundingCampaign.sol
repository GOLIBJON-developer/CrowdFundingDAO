// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/*//////////////////////////////////////////////////////////////
                            IMPORTS
//////////////////////////////////////////////////////////////*/
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IFundToken} from "./interfaces/IFundToken.sol";

/*//////////////////////////////////////////////////////////////
              DATA FLOW — CROWDFUNDING CAMPAIGN
//////////////////////////////////////////////////////////////*/
//
//  ╔══════════════════════════════════════════════════════════╗
//  ║                  CAMPAIGN STATE MACHINE                  ║
//  ╠══════════════════════════════════════════════════════════╣
//  ║  ACTIVE ──(deadline reached + goal met)──► SUCCESSFUL   ║
//  ║  ACTIVE ──(deadline reached + goal not met)─► FAILED    ║
//  ║  ACTIVE ──(creator or factory cancels)──► CANCELLED     ║
//  ╚══════════════════════════════════════════════════════════╝
//
//  contribute(msg.value):
//    contributor ──ETH──► campaign contract
//    campaign ──mint(contributor, amount)──► FundToken
//    contributor ◄──FUND tokens── FundToken
//
//  finalize() [after deadline]:
//    if totalRaised >= goal  → state = SUCCESSFUL
//    else                    → state = FAILED
//    factory.revokeCampaignRoles(address(this))  ← prevents further minting
//
//  withdraw() [SUCCESSFUL, creator only]:
//    platform fee calculated → sent to feeRecipient
//    remainder → sent to creator
//
//  refund() [FAILED or CANCELLED]:
//    campaign ──burnFrom(contributor, amount)──► FundToken
//    campaign ──ETH──► contributor
//
//  GAS OPTIMIZATIONS:
//  - All constructor params are immutable (stored in bytecode, not storage)
//  - Custom errors instead of revert strings (saves ~50 gas per revert)
//  - Storage reads cached in memory where multiple reads occur
//  - uint48 for deadline (OZ v5 pattern, saves 1 storage slot vs uint256)
//  - Checks-Effects-Interactions pattern throughout

/// @title CrowdfundingCampaign
/// @author Crowdfunding DAO
/// @notice Individual crowdfunding campaign — deployed by CampaignFactory.
///         Each campaign is its own contract (factory pattern).
///         Contributors receive FUND tokens 1:1 with ETH contributed.
///         Tokens burned on refund. Creator withdraws on success (minus fee).
/// @dev Security: ReentrancyGuard + CEI pattern + no raw .transfer()
contract CrowdfundingCampaign is ReentrancyGuard, Pausable {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/
    error CrowdfundingCampaign__NotCreator();
    error CrowdfundingCampaign__NotFactory();
    error CrowdfundingCampaign__NotActive();
    error CrowdfundingCampaign__AlreadyFinalized();
    error CrowdfundingCampaign__NotFinalizable(); // deadline not reached yet
    error CrowdfundingCampaign__NotRefundable(); // not FAILED or CANCELLED
    error CrowdfundingCampaign__NotWithdrawable(); // not SUCCESSFUL
    error CrowdfundingCampaign__DeadlineReached(); // contributing after deadline
    error CrowdfundingCampaign__ZeroContribution();
    error CrowdfundingCampaign__NoContributionFound(); // refunding with 0 balance
    error CrowdfundingCampaign__TransferFailed();
    error CrowdfundingCampaign__AlreadyWithdrawn();

    /*//////////////////////////////////////////////////////////////
                                TYPES
    //////////////////////////////////////////////////////////////*/
    /// @notice State machine — campaign can only move forward, never backward
    enum CampaignState {
        ACTIVE, // 0 — accepting contributions
        SUCCESSFUL, // 1 — goal reached, creator can withdraw
        FAILED, // 2 — deadline passed, goal not reached, contributors can refund
        CANCELLED // 3 — cancelled by creator or governance, contributors can refund
    }

    /*//////////////////////////////////////////////////////////////
                 IMMUTABLE STATE (stored in bytecode)
    //////////////////////////////////////////////////////////////*/
    // All set in constructor and never changed — 0 SLOAD cost to read
    address public immutable i_creator;
    address public immutable i_factory;
    IFundToken public immutable i_fundToken;
    uint256 public immutable i_goal;
    uint48 public immutable i_deadline; // uint48 max = year 8.9M — safe for centuries
    uint16 public immutable i_platformFeeBps; // basis points e.g. 250 = 2.5%

    /*//////////////////////////////////////////////////////////////
              MUTABLE STORAGE (minimized for gas efficiency)
    //////////////////////////////////////////////////////////////*/
    // Slot 0: s_totalRaised (uint256 = 32 bytes, full slot)
    uint256 public s_totalRaised;

    // Slot 1: s_state(1) + s_withdrawn(1) = 2 bytes (30 bytes wasted — acceptable tradeoff)
    CampaignState public s_state;
    bool public s_withdrawn; // prevents double-withdraw

    // Mappings (each entry has its own keccak-derived slot)
    mapping(address => uint256) public s_contributions;

    // String metadata (IPFS hash or description — stored as-is for simplicity)
    string public s_title;
    string public s_description;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event Contributed(address indexed contributor, uint256 amount, uint256 totalRaised);
    event Finalized(CampaignState indexed newState, uint256 totalRaised);
    event Withdrawn(address indexed creator, uint256 amount, uint256 fee);
    event Refunded(address indexed contributor, uint256 amount);
    event Cancelled(address indexed by);

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/
    modifier onlyCreator() {
        if (msg.sender != i_creator) revert CrowdfundingCampaign__NotCreator();
        _;
    }

    modifier onlyFactory() {
        if (msg.sender != i_factory) revert CrowdfundingCampaign__NotFactory();
        _;
    }

    modifier onlyActive() {
        if (s_state != CampaignState.ACTIVE) revert CrowdfundingCampaign__NotActive();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    /// @notice Deploy a new campaign — called exclusively by CampaignFactory
    /// @param creator  Who created this campaign (receives funds on success)
    /// @param factory  The factory contract (can pause/cancel this campaign)
    /// @param fundToken  The shared FUND governance token contract
    /// @param goal  Funding goal in wei
    /// @param deadline  Unix timestamp when campaign ends (uint48)
    /// @param platformFeeBps  Platform fee in basis points (factory sets this)
    /// @param title  Campaign title (stored on-chain, short)
    /// @param description  Campaign description (for longer content, store IPFS hash)
    constructor(
        address creator,
        address factory,
        address fundToken,
        uint256 goal,
        uint48 deadline,
        uint16 platformFeeBps,
        string memory title,
        string memory description
    ) {
        i_creator = creator;
        i_factory = factory;
        i_fundToken = IFundToken(fundToken);
        i_goal = goal;
        i_deadline = deadline;
        i_platformFeeBps = platformFeeBps;
        s_title = title;
        s_description = description;
        s_state = CampaignState.ACTIVE;
    }

    /*//////////////////////////////////////////////////////////////
                       CORE EXTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Contribute ETH to this campaign and receive FUND tokens
    /// @dev  Flow: ETH received → contribution recorded → FUND tokens minted 1:1
    ///       CEI: Checks (state + deadline + amount) → Effects (storage) → Interactions (mint)
    ///       payable: receives ETH directly
    ///       nonReentrant: guards against reentrancy from token.mint callback
    ///       whenNotPaused: factory can pause in emergency
    function contribute() external payable nonReentrant whenNotPaused onlyActive {
        // ── CHECKS ──────────────────────────────────────────
        if (block.timestamp >= i_deadline) revert CrowdfundingCampaign__DeadlineReached();
        if (msg.value == 0) revert CrowdfundingCampaign__ZeroContribution();

        // ── EFFECTS ─────────────────────────────────────────
        s_contributions[msg.sender] += msg.value;
        s_totalRaised += msg.value;

        emit Contributed(msg.sender, msg.value, s_totalRaised);

        // ── INTERACTIONS ─────────────────────────────────────
        // Mint FUND tokens to contributor — 1 FUND per 1 wei
        // This external call is safe: FundToken is a trusted contract deployed by us
        i_fundToken.mint(msg.sender, msg.value);
    }

    /// @notice Finalize the campaign after deadline — anyone can call
    /// @dev  Permissionless: anyone can finalize after deadline (prevents creator from
    ///       blocking a failed campaign by not finalizing). Updates state + revokes roles.
    ///       After finalization: ACTIVE → SUCCESSFUL or FAILED (irreversible)
    function finalize() external onlyActive {
        // ── CHECKS ──────────────────────────────────────────
        if (block.timestamp < i_deadline) revert CrowdfundingCampaign__NotFinalizable();

        // ── EFFECTS ─────────────────────────────────────────
        CampaignState newState;
        if (s_totalRaised >= i_goal) {
            newState = CampaignState.SUCCESSFUL;
        } else {
            newState = CampaignState.FAILED;
        }
        s_state = newState;

        emit Finalized(newState, s_totalRaised);

        // ── INTERACTIONS ─────────────────────────────────────
        // Campaign does NOT have DEFAULT_ADMIN_ROLE on FundToken — Factory does.
        // So we ask the factory to revoke our minting rights on our behalf.
        // SUCCESSFUL → revoke MINTER + BURNER (no more minting, no refunds needed)
        // FAILED     → revoke MINTER only (BURNER stays so contributors can still refund)
        ICampaignFactory(i_factory).onCampaignFinalized(newState == CampaignState.SUCCESSFUL);
    }

    /// @notice Creator withdraws ETH after successful campaign
    /// @dev  Only creator can call. Calculates fee, sends to feeRecipient, rest to creator.
    ///       s_withdrawn flag prevents double-withdrawal (extra safety beyond state check).
    function withdraw() external nonReentrant onlyCreator {
        // ── CHECKS ──────────────────────────────────────────
        if (s_state != CampaignState.SUCCESSFUL) revert CrowdfundingCampaign__NotWithdrawable();
        if (s_withdrawn) revert CrowdfundingCampaign__AlreadyWithdrawn();

        // ── EFFECTS ─────────────────────────────────────────
        s_withdrawn = true;

        uint256 balance = address(this).balance;
        // Calculate platform fee: balance * feeBps / 10000
        // Example: 10 ETH * 250 bps / 10000 = 0.25 ETH fee
        uint256 fee = (balance * i_platformFeeBps) / 10_000;
        uint256 creatorAmount = balance - fee;

        emit Withdrawn(i_creator, creatorAmount, fee);

        // ── INTERACTIONS ─────────────────────────────────────
        // Send fee to factory's fee recipient
        // Using .call{} instead of .transfer() — .transfer() can fail with smart contract recipients
        if (fee > 0) {
            address feeRecipient = ICampaignFactory(i_factory).s_feeRecipient();
            (bool feeSuccess,) = feeRecipient.call{value: fee}("");
            if (!feeSuccess) revert CrowdfundingCampaign__TransferFailed();
        }

        (bool success,) = i_creator.call{value: creatorAmount}("");
        if (!success) revert CrowdfundingCampaign__TransferFailed();
    }

    /// @notice Contributor claims ETH refund (FAILED or CANCELLED campaigns only)
    /// @dev  Burns contributor's FUND tokens and returns ETH.
    ///       CEI: Checks → Effects (zero-out contribution) → Interactions (burn + transfer)
    ///       s_contributions[msg.sender] zeroed BEFORE external calls (reentrancy protection)
    function refund() external nonReentrant {
        // ── CHECKS ──────────────────────────────────────────
        CampaignState state = s_state; // cache to avoid double SLOAD
        if (state != CampaignState.FAILED && state != CampaignState.CANCELLED) {
            revert CrowdfundingCampaign__NotRefundable();
        }

        uint256 contribution = s_contributions[msg.sender];
        if (contribution == 0) revert CrowdfundingCampaign__NoContributionFound();

        // ── EFFECTS ─────────────────────────────────────────
        // Zero BEFORE external calls — critical reentrancy protection
        s_contributions[msg.sender] = 0;

        emit Refunded(msg.sender, contribution);

        // ── INTERACTIONS ─────────────────────────────────────
        // Burn contributor's FUND tokens — campaign still has BURNER_ROLE for FAILED state
        // (finalize() only revokes MINTER_ROLE for FAILED; BURNER_ROLE kept for refunds)
        i_fundToken.burnFrom(msg.sender, contribution);

        (bool success,) = msg.sender.call{value: contribution}("");
        if (!success) revert CrowdfundingCampaign__TransferFailed();
    }

    /// @notice Cancel an active campaign
    /// @dev  Can be called by: creator (self-cancel) OR factory (DAO governance decision)
    ///       Contributors can refund after cancellation.
    function cancel() external onlyActive {
        if (msg.sender != i_creator && msg.sender != i_factory) {
            revert CrowdfundingCampaign__NotFactory();
        }

        // ── EFFECTS ─────────────────────────────────────────
        s_state = CampaignState.CANCELLED;
        emit Cancelled(msg.sender);

        // Note: BURNER_ROLE stays so contributors can still refund and burn tokens
        // MINTER_ROLE should be revoked to prevent new contributions
        // We rely on onlyActive modifier blocking contribute() after cancellation
    }

    /*//////////////////////////////////////////////////////////////
                        FACTORY-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Pause the campaign — emergency stop for contributions
    /// @dev Only factory (which is controlled by DAO governance) can pause
    function pause() external onlyFactory {
        _pause();
    }

    /// @notice Unpause the campaign
    function unpause() external onlyFactory {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get contribution amount for a specific address
    function getContribution(address contributor) external view returns (uint256) {
        return s_contributions[contributor];
    }

    /// @notice Check if campaign is currently accepting contributions
    function isAcceptingContributions() external view returns (bool) {
        return s_state == CampaignState.ACTIVE && block.timestamp < i_deadline && !paused();
    }

    /// @notice Seconds remaining until deadline (0 if past deadline)
    function timeRemaining() external view returns (uint256) {
        if (block.timestamp >= i_deadline) return 0;
        return i_deadline - block.timestamp;
    }

    /// @notice Progress toward goal as a percentage (0-100)
    /// @dev Returns 0 if goal is 0 (shouldn't happen), capped at 100
    function fundingProgress() external view returns (uint256) {
        if (i_goal == 0) return 0;
        uint256 progress = (s_totalRaised * 100) / i_goal;
        return progress > 100 ? 100 : progress;
    }

    /// @notice Get all campaign info in a single call (saves multiple RPCs from frontend)
    function getCampaignInfo()
        external
        view
        returns (
            address creator,
            uint256 goal,
            uint256 totalRaised,
            uint48 deadline,
            CampaignState state,
            bool withdrawn,
            string memory title,
            string memory description
        )
    {
        return (i_creator, i_goal, s_totalRaised, i_deadline, s_state, s_withdrawn, s_title, s_description);
    }
}

/*//////////////////////////////////////////////////////////////
                   MINIMAL FACTORY INTERFACE
//////////////////////////////////////////////////////////////*/
// Defined here to avoid circular imports — Campaign needs to read
// feeRecipient from Factory during withdraw()
interface ICampaignFactory {
    function s_feeRecipient() external view returns (address);

    /// @notice Called by a campaign after finalization to revoke its token roles.
    /// @dev Factory holds DEFAULT_ADMIN_ROLE on FundToken, so only factory can revoke.
    ///      Campaign itself cannot call fundToken.revoke*() directly.
    /// @param successful  true = SUCCESSFUL (revoke both roles), false = FAILED (revoke minter only)
    function onCampaignFinalized(bool successful) external;
}
