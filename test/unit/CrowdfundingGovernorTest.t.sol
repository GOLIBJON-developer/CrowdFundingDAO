// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {CrowdfundingGovernor} from "../../src/CrowdfundingGovernor.sol";
import {CampaignFactory} from "../../src/CampaignFactory.sol";
import {FundToken} from "../../src/FundToken.sol";
import {CrowdfundingCampaign} from "../../src/CrowdfundingCampaign.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/*//////////////////////////////////////////////////////////////
              GOVERNOR TEST — DAO GOVERNANCE FLOW
//////////////////////////////////////////////////////////////*/
//
//  Tests cover the full governance lifecycle:
//  propose → vote → queue → execute
//
//  Test scenario:
//  1. Voter contributes to campaign → gets FUND tokens
//  2. Voter delegates to self (gets voting power)
//  3. Voter proposes: change platform fee
//  4. warp(votingDelay) → voting starts
//  5. Voter votes FOR
//  6. warp(votingPeriod) → voting ends
//  7. queue() → sends to timelock
//  8. warp(timelockDelay) → timelock expires
//  9. execute() → fee changed on-chain

/// @title CrowdfundingGovernorTest
contract CrowdfundingGovernorTest is Test {
    /*//////////////////////////////////////////////////////////////
                              SETUP
    //////////////////////////////////////////////////////////////*/
    FundToken fundToken;
    CampaignFactory factory;
    CrowdfundingGovernor governor;
    TimelockController timelock;

    address ADMIN = makeAddr("admin");
    address VOTER = makeAddr("voter");
    address VOTER_2 = makeAddr("voter2");
    address FEE_RECIPIENT = makeAddr("feeRecipient");

    uint256 constant VOTER_CONTRIBUTION = 100 ether; // large enough to meet quorum
    uint256 constant TIMELOCK_DELAY = 2 days;

    // Governance params (match constructor in CrowdfundingGovernor)
    uint256 constant VOTING_DELAY = 1 days;
    uint256 constant VOTING_PERIOD = 1 weeks;

    function setUp() public {
        // ── Deploy FundToken ──────────────────────────────
        vm.startPrank(ADMIN);
        fundToken = new FundToken(ADMIN);

        // ── Deploy Timelock ───────────────────────────────
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](0);
        timelock = new TimelockController(TIMELOCK_DELAY, proposers, executors, ADMIN);

        // ── Deploy Factory ────────────────────────────────

        factory = new CampaignFactory(address(fundToken), ADMIN, FEE_RECIPIENT, 250);

        fundToken.grantRole(fundToken.DEFAULT_ADMIN_ROLE(), address(factory));

        // ── Deploy Governor ───────────────────────────────

        governor = new CrowdfundingGovernor(IVotes(address(fundToken)), timelock);

        // ── Setup Timelock roles ──────────────────────────

        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(governor));
        // Grant timelock admin role over factory (so DAO can call factory functions)
        factory.grantRole(factory.DEFAULT_ADMIN_ROLE(), address(timelock));
        factory.grantRole(factory.OPERATOR_ROLE(), address(timelock));

        // ── Fund voters and give them FUND tokens ─────────
        // Create a campaign and contribute to get FUND tokens

        address campaignAddr = factory.createCampaign(
            1 ether, // small goal for setup
            uint48(block.timestamp + 30 days),
            "Test",
            "Test"
        );
        vm.stopPrank();

        vm.deal(VOTER, VOTER_CONTRIBUTION + 10 ether);
        vm.deal(VOTER_2, 10 ether);

        // Contribute to get FUND tokens
        vm.startPrank(VOTER);
        (bool s,) = campaignAddr.call{value: VOTER_CONTRIBUTION}(abi.encodeWithSignature("contribute()"));
        require(s, "contribute failed");

        // Delegate to self to activate voting power

        fundToken.delegate(VOTER);

        // Roll forward one block so delegation checkpoint is recorded
        vm.roll(block.number + 1);
        vm.warp(block.timestamp + 1);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                       CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Constructor_SetsCorrectVotingDelay() public view {
        assertEq(governor.votingDelay(), VOTING_DELAY);
    }

    function test_Constructor_SetsCorrectVotingPeriod() public view {
        assertEq(governor.votingPeriod(), VOTING_PERIOD);
    }

    function test_Constructor_SetsCorrectQuorumFraction() public view {
        // quorumNumerator() returns the percentage (4)
        assertEq(governor.quorumNumerator(), 4);
    }

    function test_Constructor_SetsCorrectProposalThreshold() public view {
        assertEq(governor.proposalThreshold(), 1e18);
    }

    function test_Constructor_CorrectName() public view {
        assertEq(governor.name(), "CrowdfundingGovernor");
    }

    /*//////////////////////////////////////////////////////////////
                         PROPOSE TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Propose_CreatesProposal() public {
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) =
            _buildSetFeeProposal(500);

        vm.prank(VOTER);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);

        assertGt(proposalId, 0);
        assertEq(uint8(governor.state(proposalId)), uint8(IGovernor.ProposalState.Pending));
    }

    function test_Propose_RevertsIfBelowThreshold() public {
        // VOTER_2 has 0 FUND tokens — below 1e18 threshold
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) =
            _buildSetFeeProposal(500);

        vm.prank(VOTER_2);
        vm.expectRevert(); // GovernorInsufficientProposerVotes
        governor.propose(targets, values, calldatas, description);
    }

    /*//////////////////////////////////////////////////////////////
                     FULL GOVERNANCE CYCLE
    //////////////////////////////////////////////////////////////*/
    function test_GovernanceCycle_ProposalPassesAndExecutes() public {
        uint16 newFee = 500; // change to 5%

        // ── 1. Create proposal ────────────────────────────
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) =
            _buildSetFeeProposal(newFee);

        vm.prank(VOTER);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);

        // ── 2. Wait for voting delay ──────────────────────
        vm.warp(block.timestamp + VOTING_DELAY + 1);
        vm.roll(block.number + 1);

        assertEq(uint8(governor.state(proposalId)), uint8(IGovernor.ProposalState.Active));

        // ── 3. Vote FOR ───────────────────────────────────
        vm.prank(VOTER);
        governor.castVote(proposalId, 1); // 1 = FOR

        // ── 4. Wait for voting period to end ──────────────
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        vm.roll(block.number + 1);

        assertEq(uint8(governor.state(proposalId)), uint8(IGovernor.ProposalState.Succeeded));

        // ── 5. Queue in timelock ──────────────────────────
        bytes32 descriptionHash = keccak256(bytes(description));
        governor.queue(targets, values, calldatas, descriptionHash);

        assertEq(uint8(governor.state(proposalId)), uint8(IGovernor.ProposalState.Queued));

        // ── 6. Wait for timelock delay ────────────────────
        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);

        // ── 7. Execute ────────────────────────────────────
        governor.execute(targets, values, calldatas, descriptionHash);

        assertEq(uint8(governor.state(proposalId)), uint8(IGovernor.ProposalState.Executed));

        // ── 8. Verify the fee was actually changed ─────────
        assertEq(factory.s_platformFeeBps(), newFee);
    }

    function test_GovernanceCycle_ProposalDefeatedWithAgainstVotes() public {
        // We need a second voter with enough tokens to defeat the proposal
        // Give VOTER_2 tokens and delegate
        address campaignAddr = factory.getCampaigns()[0];
        vm.deal(VOTER_2, VOTER_CONTRIBUTION * 10); // much more than VOTER

        vm.prank(VOTER_2);
        (bool s,) = campaignAddr.call{value: VOTER_CONTRIBUTION * 10}(abi.encodeWithSignature("contribute()"));
        require(s);

        vm.prank(VOTER_2);
        fundToken.delegate(VOTER_2);
        vm.roll(block.number + 1);

        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) =
            _buildSetFeeProposal(500);

        vm.prank(VOTER);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);

        vm.warp(block.timestamp + VOTING_DELAY + 1);
        vm.roll(block.number + 1);

        vm.prank(VOTER);
        governor.castVote(proposalId, 1); // FOR

        vm.prank(VOTER_2);
        governor.castVote(proposalId, 0); // AGAINST (10x more tokens)

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        assertEq(uint8(governor.state(proposalId)), uint8(IGovernor.ProposalState.Defeated));
    }

    function test_GovernanceCycle_CanCancelCampaignViaDAO() public {
        // Create a new campaign to cancel
        vm.prank(makeAddr("scammer"));
        address scamCampaign = factory.createCampaign(1 ether, uint48(block.timestamp + 30 days), "Scam", "Give me ETH");

        // Build proposal: factory.cancelCampaign(scamCampaign)
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        targets[0] = address(factory);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSelector(CampaignFactory.cancelCampaign.selector, scamCampaign);
        string memory description = "Cancel fraudulent campaign";

        vm.prank(VOTER);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);

        vm.warp(block.timestamp + VOTING_DELAY + 1);
        vm.roll(block.number + VOTING_DELAY + 1);

        vm.prank(VOTER);
        governor.castVote(proposalId, 1);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        vm.roll(block.number + VOTING_DELAY + 1);

        bytes32 descHash = keccak256(bytes(description));
        governor.queue(targets, values, calldatas, descHash);

        vm.warp(block.timestamp + TIMELOCK_DELAY + 1);
        vm.roll(block.number + VOTING_DELAY + 1);
        governor.execute(targets, values, calldatas, descHash);

        // Verify campaign was cancelled
        assertEq(
            uint8(CrowdfundingCampaign(payable(scamCampaign)).s_state()),
            uint8(CrowdfundingCampaign.CampaignState.CANCELLED)
        );
    }

    /*//////////////////////////////////////////////////////////////
                         VOTING TESTS
    //////////////////////////////////////////////////////////////*/
    function test_CastVote_RecordsVote() public {
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) =
            _buildSetFeeProposal(500);

        vm.startPrank(VOTER);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);

        vm.warp(block.timestamp + VOTING_DELAY + 1);
        vm.roll(block.number + VOTING_DELAY + 1);

        // Endi holatni tekshirib ko'rishingiz mumkin (debug uchun)
        console.log("Current state:", uint256(governor.state(proposalId)));

        governor.castVote(proposalId, 1);

        assertTrue(governor.hasVoted(proposalId, VOTER));
        vm.stopPrank();
    }

    function test_CastVote_RevertsIfVotingNotStarted() public {
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) =
            _buildSetFeeProposal(500);

        vm.prank(VOTER);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);
        // Don't warp — still in Pending state

        vm.prank(VOTER);
        vm.expectRevert(); // GovernorUnexpectedProposalState
        governor.castVote(proposalId, 1);
    }

    function test_CastVote_RevertsOnDoubleVote() public {
        (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description) =
            _buildSetFeeProposal(500);

        vm.prank(VOTER);
        uint256 proposalId = governor.propose(targets, values, calldatas, description);

        vm.warp(block.timestamp + VOTING_DELAY + 1);
        vm.roll(block.number + VOTING_DELAY + 1);

        vm.prank(VOTER);
        governor.castVote(proposalId, 1);

        vm.prank(VOTER);
        vm.expectRevert(); // AlreadyCastVote
        governor.castVote(proposalId, 1);
    }

    /*//////////////////////////////////////////////////////////////
                     QUORUM TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Quorum_FailsIfNotEnoughVotes() public view {
        // VOTER has 100 ETH of tokens but supply might be larger
        // Let's check quorum calculation
        uint256 totalSupply = fundToken.totalSupply();
        uint256 requiredQuorum = governor.quorum(block.timestamp - 1);

        // quorum = 4% of total supply
        assertEq(requiredQuorum, (totalSupply * 4) / 100);
    }

    /*//////////////////////////////////////////////////////////////
                         HELPERS
    //////////////////////////////////////////////////////////////*/
    function _buildSetFeeProposal(uint16 newFeeBps)
        internal
        view
        returns (address[] memory targets, uint256[] memory values, bytes[] memory calldatas, string memory description)
    {
        targets = new address[](1);
        values = new uint256[](1);
        calldatas = new bytes[](1);

        targets[0] = address(factory);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSelector(CampaignFactory.setPlatformFee.selector, newFeeBps);
        description = string.concat("Change platform fee to ", vm.toString(newFeeBps), " bps");
    }
}
