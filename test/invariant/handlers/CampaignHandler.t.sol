// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {CrowdfundingCampaign} from "../../../src/CrowdfundingCampaign.sol";
import {CampaignFactory} from "../../../src/CampaignFactory.sol";
import {FundToken} from "../../../src/FundToken.sol";

/// @title CampaignHandler
/// @notice Handler for invariant testing — wraps campaign actions with valid preconditions
/// @dev Foundry's invariant fuzzer calls functions on this contract randomly.
///      The handler ensures only valid state transitions happen (e.g., don't try
///      to contribute after deadline — that would trivially revert and waste runs).
///      Ghost variables track expected state for invariant assertions.
contract CampaignHandler is Test {
    /*//////////////////////////////////////////////////////////////
                           CONTRACTS
    //////////////////////////////////////////////////////////////*/
    CrowdfundingCampaign public campaign;
    CampaignFactory public factory;
    FundToken public fundToken;

    /*//////////////////////////////////////////////////////////////
                        GHOST VARIABLES
    //////////////////////////////////////////////////////////////*/
    // Track contributions by address (mirrors campaign storage)
    mapping(address => uint256) public ghost_contributions;

    // Track total contributed
    uint256 public ghost_totalContributed;

    // Track total refunded
    uint256 public ghost_totalRefunded;

    // Track total tokens minted
    uint256 public ghost_tokensMinted;

    // Track total tokens burned
    uint256 public ghost_tokensBurned;

    // Contributors set (for iteration)
    address[] public contributors;
    mapping(address => bool) public isContributor;

    // Call counts for coverage analysis
    uint256 public callCount_contribute;
    uint256 public callCount_refund;
    uint256 public callCount_finalize;
    uint256 public callCount_withdraw;

    /*//////////////////////////////////////////////////////////////
                           CONSTANTS
    //////////////////////////////////////////////////////////////*/
    uint256 constant MAX_CONTRIBUTION = 10 ether;

    constructor(CrowdfundingCampaign _campaign, CampaignFactory _factory, FundToken _fundToken) {
        campaign = _campaign;
        factory = _factory;
        fundToken = _fundToken;
    }

    /*//////////////////////////////////////////////////////////////
                        HANDLER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Contribute to campaign — only when ACTIVE and before deadline
    function contribute(uint256 actorSeed, uint256 amount) external {
        // Guard: only contribute when campaign is active
        if (campaign.s_state() != CrowdfundingCampaign.CampaignState.ACTIVE) return;
        if (block.timestamp >= campaign.i_deadline()) return;

        // Bound inputs to valid ranges
        amount = bound(amount, 0.001 ether, MAX_CONTRIBUTION);
        address actor = _getActor(actorSeed);

        vm.deal(actor, amount);

        vm.prank(actor);
        try campaign.contribute{value: amount}() {
            // Update ghost state
            if (!isContributor[actor]) {
                contributors.push(actor);
                isContributor[actor] = true;
            }
            ghost_contributions[actor] += amount;
            ghost_totalContributed += amount;
            ghost_tokensMinted += amount;
            callCount_contribute++;
        } catch {
            // Contribution failed — acceptable (e.g., reentrancy guard)
        }
    }

    /// @notice Finalize campaign — only after deadline
    function finalize() external {
        if (campaign.s_state() != CrowdfundingCampaign.CampaignState.ACTIVE) return;
        if (block.timestamp < campaign.i_deadline()) return;

        try campaign.finalize() {
            callCount_finalize++;
        } catch {}
    }

    /// @notice Refund — only when FAILED or CANCELLED
    function refund(uint256 actorSeed) external {
        CrowdfundingCampaign.CampaignState state = campaign.s_state();
        if (state != CrowdfundingCampaign.CampaignState.FAILED && state != CrowdfundingCampaign.CampaignState.CANCELLED)
        {
            return;
        }

        if (contributors.length == 0) return;

        address actor = contributors[actorSeed % contributors.length];
        uint256 contribution = ghost_contributions[actor];
        if (contribution == 0) return; // already refunded

        vm.prank(actor);
        try campaign.refund() {
            ghost_contributions[actor] = 0;
            ghost_totalRefunded += contribution;
            ghost_tokensBurned += contribution;
            callCount_refund++;
        } catch {}
    }

    /// @notice Warp time forward — advances the clock
    function warpTime(uint256 secondsToWarp) external {
        secondsToWarp = bound(secondsToWarp, 1, 60 days);
        vm.warp(block.timestamp + secondsToWarp);
    }

    /*//////////////////////////////////////////////////////////////
                            HELPERS
    //////////////////////////////////////////////////////////////*/

    function _getActor(uint256 seed) internal pure returns (address) {
        // Generate deterministic actor addresses from seed
        return address(uint160(uint256(keccak256(abi.encodePacked(seed % 10)))));
    }

    function getContributors() external view returns (address[] memory) {
        return contributors;
    }

    function getContributorCount() external view returns (uint256) {
        return contributors.length;
    }
}
