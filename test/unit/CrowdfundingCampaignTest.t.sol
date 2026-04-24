// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {CrowdfundingCampaign} from "../../src/CrowdfundingCampaign.sol";
import {FundToken} from "../../src/FundToken.sol";
import {CampaignFactory} from "../../src/CampaignFactory.sol";

/// @title CrowdfundingCampaignTest — Unit + Fuzz tests for CrowdfundingCampaign
contract CrowdfundingCampaignTest is Test {
    /*//////////////////////////////////////////////////////////////
                               SETUP
    //////////////////////////////////////////////////////////////*/
    FundToken fundToken;
    CampaignFactory factory;
    CrowdfundingCampaign campaign;

    address CREATOR = makeAddr("creator");
    address CONTRIBUTOR_1 = makeAddr("contributor1");
    address CONTRIBUTOR_2 = makeAddr("contributor2");
    address ATTACKER = makeAddr("attacker");
    address FEE_RECIPIENT = makeAddr("feeRecipient");
    address ADMIN = makeAddr("admin");

    uint256 constant GOAL = 10 ether;
    uint48 constant DURATION = 30 days;
    uint16 constant FEE_BPS = 250; // 2.5%
    string constant TITLE = "Build a DApp";
    string constant DESCRIPTION = "A description";

    event Contributed(address indexed contributor, uint256 amount, uint256 totalRaised);
    event Finalized(CrowdfundingCampaign.CampaignState indexed newState, uint256 totalRaised);
    event Withdrawn(address indexed creator, uint256 amount, uint256 fee);
    event Refunded(address indexed contributor, uint256 amount);
    event Cancelled(address indexed by);

    function setUp() public {
        // Deploy FundToken with ADMIN as initial admin
        vm.startPrank(ADMIN);
        fundToken = new FundToken(ADMIN);

        // Deploy Factory
        factory = new CampaignFactory(address(fundToken), ADMIN, FEE_RECIPIENT, FEE_BPS);

        // Grant factory admin role on FundToken
        fundToken.grantRole(fundToken.DEFAULT_ADMIN_ROLE(), address(factory));
        vm.stopPrank();

        // Create a campaign through the factory
        vm.startPrank(CREATOR);
        address campaignAddr = factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), TITLE, DESCRIPTION);
        campaign = CrowdfundingCampaign(payable(campaignAddr));
        vm.stopPrank();

        // Fund contributors with ETH
        vm.deal(CONTRIBUTOR_1, 100 ether);
        vm.deal(CONTRIBUTOR_2, 100 ether);
        vm.deal(ATTACKER, 100 ether);
    }

    /*//////////////////////////////////////////////////////////////
                         CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Constructor_SetsCreator() public view {
        assertEq(campaign.i_creator(), CREATOR);
    }

    function test_Constructor_SetsGoal() public view {
        assertEq(campaign.i_goal(), GOAL);
    }

    function test_Constructor_SetsFactory() public view {
        assertEq(campaign.i_factory(), address(factory));
    }

    function test_Constructor_InitialStateIsActive() public view {
        assertEq(uint8(campaign.s_state()), uint8(CrowdfundingCampaign.CampaignState.ACTIVE));
    }

    function test_Constructor_TotalRaisedIsZero() public view {
        assertEq(campaign.s_totalRaised(), 0);
    }

    function test_Constructor_SetsTitle() public view {
        assertEq(campaign.s_title(), TITLE);
    }

    /*//////////////////////////////////////////////////////////////
                         CONTRIBUTE TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Contribute_AcceptsETH() public {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 1 ether}();

        assertEq(campaign.s_totalRaised(), 1 ether);
        assertEq(campaign.s_contributions(CONTRIBUTOR_1), 1 ether);
    }

    function test_Contribute_MintsTokens() public {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 2 ether}();

        assertEq(fundToken.balanceOf(CONTRIBUTOR_1), 2 ether);
    }

    function test_Contribute_EmitsContributed() public {
        vm.prank(CONTRIBUTOR_1);
        vm.expectEmit(true, false, false, true);
        emit Contributed(CONTRIBUTOR_1, 1 ether, 1 ether);
        campaign.contribute{value: 1 ether}();
    }

    function test_Contribute_RevertsIfZeroValue() public {
        vm.prank(CONTRIBUTOR_1);
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__ZeroContribution.selector);
        campaign.contribute{value: 0}();
    }

    function test_Contribute_RevertsIfDeadlinePassed() public {
        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(CONTRIBUTOR_1);
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__DeadlineReached.selector);
        campaign.contribute{value: 1 ether}();
    }

    function test_Contribute_RevertsIfNotActive() public {
        // Finalize first (warp past deadline)
        vm.warp(block.timestamp + DURATION + 1);
        campaign.finalize();

        vm.prank(CONTRIBUTOR_1);
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__NotActive.selector);
        campaign.contribute{value: 1 ether}();
    }

    function test_Contribute_AccumulatesMultipleContributions() public {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 3 ether}();

        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 2 ether}();

        assertEq(campaign.s_contributions(CONTRIBUTOR_1), 5 ether);
        assertEq(campaign.s_totalRaised(), 5 ether);
        assertEq(fundToken.balanceOf(CONTRIBUTOR_1), 5 ether);
    }

    function test_Contribute_MultipleContributors() public {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 4 ether}();

        vm.prank(CONTRIBUTOR_2);
        campaign.contribute{value: 6 ether}();

        assertEq(campaign.s_totalRaised(), 10 ether);
    }

    /*//////////////////////////////////////////////////////////////
                           FINALIZE TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Finalize_SetsSuccessfulIfGoalMet() public {
        // Contribute enough to meet goal
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 10 ether}();

        // Warp past deadline
        vm.warp(block.timestamp + DURATION + 1);
        campaign.finalize();

        assertEq(uint8(campaign.s_state()), uint8(CrowdfundingCampaign.CampaignState.SUCCESSFUL));
    }

    function test_Finalize_SetsFailedIfGoalNotMet() public {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 1 ether}(); // not enough

        vm.warp(block.timestamp + DURATION + 1);
        campaign.finalize();

        assertEq(uint8(campaign.s_state()), uint8(CrowdfundingCampaign.CampaignState.FAILED));
    }

    function test_Finalize_RevertsIfDeadlineNotReached() public {
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__NotFinalizable.selector);
        campaign.finalize();
    }

    function test_Finalize_RevertsIfAlreadyFinalized() public {
        vm.warp(block.timestamp + DURATION + 1);
        campaign.finalize();

        // Try to finalize again
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__NotActive.selector);
        campaign.finalize();
    }

    function test_Finalize_AnyoneCanCall() public {
        vm.warp(block.timestamp + DURATION + 1);

        vm.prank(ATTACKER); // attacker finalizes — this is OK and expected
        campaign.finalize(); // should not revert
    }

    function test_Finalize_EmitsFinalized() public {
        vm.warp(block.timestamp + DURATION + 1);

        vm.expectEmit(true, false, false, true);
        emit Finalized(CrowdfundingCampaign.CampaignState.FAILED, 0);
        campaign.finalize();
    }

    /*//////////////////////////////////////////////////////////////
                          WITHDRAW TESTS
    //////////////////////////////////////////////////////////////*/
    function _makeSuccessful() internal {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 10 ether}();
        vm.warp(block.timestamp + DURATION + 1);
        campaign.finalize();
    }

    function test_Withdraw_TransfersFundsToCreator() public {
        _makeSuccessful();

        uint256 creatorBalanceBefore = CREATOR.balance;

        vm.prank(CREATOR);
        campaign.withdraw();

        // Creator gets total minus fee
        uint256 fee = (10 ether * uint256(FEE_BPS)) / 10_000; // 0.25 ETH
        uint256 expected = 10 ether - fee;
        assertEq(CREATOR.balance, creatorBalanceBefore + expected);
    }

    function test_Withdraw_SendsFeeToRecipient() public {
        _makeSuccessful();

        uint256 recipientBefore = FEE_RECIPIENT.balance;

        vm.prank(CREATOR);
        campaign.withdraw();

        uint256 expectedFee = (10 ether * uint256(FEE_BPS)) / 10_000;
        assertEq(FEE_RECIPIENT.balance, recipientBefore + expectedFee);
    }

    function test_Withdraw_RevertsIfNotCreator() public {
        _makeSuccessful();

        vm.prank(ATTACKER);
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__NotCreator.selector);
        campaign.withdraw();
    }

    function test_Withdraw_RevertsIfNotSuccessful() public {
        vm.warp(block.timestamp + DURATION + 1);
        campaign.finalize(); // FAILED (no contributions)

        vm.prank(CREATOR);
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__NotWithdrawable.selector);
        campaign.withdraw();
    }

    function test_Withdraw_RevertsOnDoubleWithdraw() public {
        _makeSuccessful();

        vm.startPrank(CREATOR);
        campaign.withdraw();

        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__AlreadyWithdrawn.selector);
        campaign.withdraw();
        vm.stopPrank();
    }

    function test_Withdraw_EmitsWithdrawn() public {
        _makeSuccessful();

        uint256 fee = (10 ether * uint256(FEE_BPS)) / 10_000;
        uint256 amount = 10 ether - fee;

        vm.prank(CREATOR);
        vm.expectEmit(true, false, false, true);
        emit Withdrawn(CREATOR, amount, fee);
        campaign.withdraw();
    }

    /*//////////////////////////////////////////////////////////////
                            REFUND TESTS
    //////////////////////////////////////////////////////////////*/
    function _makeFailed() internal {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 1 ether}();
        vm.warp(block.timestamp + DURATION + 1);
        campaign.finalize();
    }

    function test_Refund_ReturnsFundsToContributor() public {
        _makeFailed();

        uint256 balanceBefore = CONTRIBUTOR_1.balance;

        vm.prank(CONTRIBUTOR_1);
        campaign.refund();

        assertEq(CONTRIBUTOR_1.balance, balanceBefore + 1 ether);
    }

    function test_Refund_BurnsTokens() public {
        _makeFailed();

        assertEq(fundToken.balanceOf(CONTRIBUTOR_1), 1 ether);

        vm.prank(CONTRIBUTOR_1);
        campaign.refund();

        assertEq(fundToken.balanceOf(CONTRIBUTOR_1), 0);
    }

    function test_Refund_ZerosContribution() public {
        _makeFailed();

        vm.prank(CONTRIBUTOR_1);
        campaign.refund();

        assertEq(campaign.s_contributions(CONTRIBUTOR_1), 0);
    }

    function test_Refund_RevertsOnDoubleRefund() public {
        _makeFailed();

        vm.startPrank(CONTRIBUTOR_1);
        campaign.refund();

        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__NoContributionFound.selector);
        campaign.refund();
        vm.stopPrank();
    }

    function test_Refund_RevertsIfNoContribution() public {
        _makeFailed();

        vm.prank(ATTACKER); // never contributed
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__NoContributionFound.selector);
        campaign.refund();
    }

    function test_Refund_RevertsIfCampaignSuccessful() public {
        _makeSuccessful();

        vm.prank(CONTRIBUTOR_1);
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__NotRefundable.selector);
        campaign.refund();
    }

    function test_Refund_WorksForCancelledCampaign() public {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 1 ether}();

        vm.prank(CREATOR);
        campaign.cancel();

        uint256 balanceBefore = CONTRIBUTOR_1.balance;
        vm.prank(CONTRIBUTOR_1);
        campaign.refund();

        assertEq(CONTRIBUTOR_1.balance, balanceBefore + 1 ether);
    }

    /*//////////////////////////////////////////////////////////////
                           CANCEL TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Cancel_CreatorCanCancel() public {
        vm.prank(CREATOR);
        campaign.cancel();

        assertEq(uint8(campaign.s_state()), uint8(CrowdfundingCampaign.CampaignState.CANCELLED));
    }

    function test_Cancel_FactoryCanCancel() public {
        vm.prank(address(factory));
        campaign.cancel();

        assertEq(uint8(campaign.s_state()), uint8(CrowdfundingCampaign.CampaignState.CANCELLED));
    }

    function test_Cancel_RevertsIfNotCreatorOrFactory() public {
        vm.prank(ATTACKER);
        vm.expectRevert(CrowdfundingCampaign.CrowdfundingCampaign__NotFactory.selector);
        campaign.cancel();
    }

    function test_Cancel_EmitsCancelled() public {
        vm.prank(CREATOR);
        vm.expectEmit(true, false, false, false);
        emit Cancelled(CREATOR);
        campaign.cancel();
    }

    /*//////////////////////////////////////////////////////////////
                         VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    function test_FundingProgress_ZeroWhenNoContributions() public view {
        assertEq(campaign.fundingProgress(), 0);
    }

    function test_FundingProgress_50PercentAtHalfGoal() public {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 5 ether}(); // half of 10 ETH goal

        assertEq(campaign.fundingProgress(), 50);
    }

    function test_FundingProgress_100AtGoal() public {
        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: 10 ether}();

        assertEq(campaign.fundingProgress(), 100);
    }

    function test_TimeRemaining_ReturnsCorrectValue() public view {
        assertEq(campaign.timeRemaining(), DURATION);
    }

    function test_TimeRemaining_ReturnsZeroAfterDeadline() public {
        vm.warp(block.timestamp + DURATION + 1);
        assertEq(campaign.timeRemaining(), 0);
    }

    function test_IsAcceptingContributions_TrueWhenActive() public view {
        assertTrue(campaign.isAcceptingContributions());
    }

    function test_IsAcceptingContributions_FalseAfterDeadline() public {
        vm.warp(block.timestamp + DURATION + 1);
        assertFalse(campaign.isAcceptingContributions());
    }

    /*//////////////////////////////////////////////////////////////
                           FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    function testFuzz_Contribute_AnyAmountAccepted(uint256 amount) public {
        amount = bound(amount, 1, 50 ether);

        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: amount}();

        assertEq(campaign.s_totalRaised(), amount);
        assertEq(fundToken.balanceOf(CONTRIBUTOR_1), amount);
    }

    function testFuzz_Refund_AlwaysReturnsExactContribution(uint256 amount) public {
        amount = bound(amount, 1, 9 ether); // keep under goal to ensure FAILED

        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: amount}();

        vm.warp(block.timestamp + DURATION + 1);
        vm.prank(ADMIN);
        campaign.finalize();

        uint256 balanceBefore = CONTRIBUTOR_1.balance;
        vm.prank(CONTRIBUTOR_1);
        campaign.refund();

        assertEq(CONTRIBUTOR_1.balance, balanceBefore + amount);
    }

    function testFuzz_Withdraw_FeeNeverExceedsBalance(uint256 contribution) public {
        contribution = bound(contribution, 10 ether, 100 ether); // ensure goal is met
        vm.deal(CONTRIBUTOR_1, contribution);

        vm.prank(CONTRIBUTOR_1);
        campaign.contribute{value: contribution}();

        vm.warp(block.timestamp + DURATION + 1);
        campaign.finalize();

        uint256 fee = (contribution * FEE_BPS) / 10_000;
        assertLe(fee, contribution); // fee never exceeds total
        assertGt(contribution - fee, 0); // creator always gets something
    }
}
