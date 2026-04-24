// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {CampaignFactory} from "../../src/CampaignFactory.sol";
import {CrowdfundingCampaign} from "../../src/CrowdfundingCampaign.sol";
import {FundToken} from "../../src/FundToken.sol";

/// @title CampaignFactoryTest — Unit + Fuzz tests for CampaignFactory
contract CampaignFactoryTest is Test {
    /*//////////////////////////////////////////////////////////////
                               SETUP
    //////////////////////////////////////////////////////////////*/
    FundToken fundToken;
    CampaignFactory factory;

    address ADMIN = makeAddr("admin");
    address OPERATOR = makeAddr("operator");
    address CREATOR = makeAddr("creator");
    address CREATOR_2 = makeAddr("creator2");
    address FEE_RECIPIENT = makeAddr("feeRecipient");
    address ATTACKER = makeAddr("attacker");
    address NEW_FEE_RECIPIENT = makeAddr("newFeeRecipient");

    uint16 constant FEE_BPS = 250;
    uint256 constant GOAL = 10 ether;
    uint48 constant DURATION = 30 days;

    event CampaignCreated(
        address indexed campaign, address indexed creator, uint256 goal, uint48 deadline, string title
    );
    event PlatformFeeUpdated(uint16 oldFeeBps, uint16 newFeeBps);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    function setUp() public {
        vm.startPrank(ADMIN);
        fundToken = new FundToken(ADMIN);

        factory = new CampaignFactory(address(fundToken), ADMIN, FEE_RECIPIENT, FEE_BPS);

        fundToken.grantRole(fundToken.DEFAULT_ADMIN_ROLE(), address(factory));

        factory.grantRole(factory.OPERATOR_ROLE(), OPERATOR);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                        CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Constructor_SetsFundToken() public view {
        assertEq(address(factory.i_fundToken()), address(fundToken));
    }

    function test_Constructor_SetsAdmin() public view {
        assertTrue(factory.hasRole(factory.DEFAULT_ADMIN_ROLE(), ADMIN));
    }

    function test_Constructor_SetsFeeRecipient() public view {
        assertEq(factory.s_feeRecipient(), FEE_RECIPIENT);
    }

    function test_Constructor_SetsFee() public view {
        assertEq(factory.s_platformFeeBps(), FEE_BPS);
    }

    function test_Constructor_RevertsIfZeroFundToken() public {
        vm.expectRevert(CampaignFactory.CampaignFactory__ZeroAddress.selector);
        new CampaignFactory(address(0), ADMIN, FEE_RECIPIENT, FEE_BPS);
    }

    function test_Constructor_RevertsIfZeroAdmin() public {
        vm.expectRevert(CampaignFactory.CampaignFactory__ZeroAddress.selector);
        new CampaignFactory(address(fundToken), address(0), FEE_RECIPIENT, FEE_BPS);
    }

    function test_Constructor_RevertsIfFeeExceedsMax() public {
        vm.expectRevert(CampaignFactory.CampaignFactory__InvalidFee.selector);
        new CampaignFactory(address(fundToken), ADMIN, FEE_RECIPIENT, 1001); // > 10%
    }

    /*//////////////////////////////////////////////////////////////
                      CREATE CAMPAIGN TESTS
    //////////////////////////////////////////////////////////////*/
    function test_CreateCampaign_ReturnsDeployedAddress() public {
        vm.prank(CREATOR);
        address campaignAddr = factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "Test", "Description");

        assertTrue(campaignAddr != address(0));
        assertTrue(campaignAddr.code.length > 0); // is a contract
    }

    function test_CreateCampaign_RegistersCampaign() public {
        vm.prank(CREATOR);
        address campaignAddr = factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "Test", "Description");

        assertTrue(factory.s_isCampaign(campaignAddr));
    }

    function test_CreateCampaign_IncrementsCount() public {
        assertEq(factory.getCampaignCount(), 0);

        vm.prank(CREATOR);
        factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "T", "D");

        assertEq(factory.getCampaignCount(), 1);
    }

    function test_CreateCampaign_TracksByCreator() public {
        vm.prank(CREATOR);
        address campaignAddr = factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "T", "D");

        address[] memory creatorCampaigns = factory.getCampaignsByCreator(CREATOR);
        assertEq(creatorCampaigns.length, 1);
        assertEq(creatorCampaigns[0], campaignAddr);
    }

    function test_CreateCampaign_GrantsMinterRoleToCampaign() public {
        vm.prank(CREATOR);
        address campaignAddr = factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "T", "D");

        assertTrue(fundToken.hasRole(fundToken.MINTER_ROLE(), campaignAddr));
        assertTrue(fundToken.hasRole(fundToken.BURNER_ROLE(), campaignAddr));
    }

    function test_CreateCampaign_EmitsCampaignCreated() public {
        uint48 deadline = uint48(block.timestamp + DURATION);

        vm.prank(CREATOR);
        vm.expectEmit(false, true, false, false); // don't check campaign addr (unknown before creation)
        emit CampaignCreated(address(0), CREATOR, GOAL, deadline, "Test");
        factory.createCampaign(GOAL, deadline, "Test", "D");
    }

    function test_CreateCampaign_RevertsIfGoalIsZero() public {
        vm.prank(CREATOR);
        vm.expectRevert(CampaignFactory.CampaignFactory__InvalidGoal.selector);
        factory.createCampaign(0, uint48(block.timestamp + DURATION), "T", "D");
    }

    function test_CreateCampaign_RevertsIfDeadlineInPast() public {
        vm.prank(CREATOR);
        vm.expectRevert(CampaignFactory.CampaignFactory__InvalidDeadline.selector);
        factory.createCampaign(GOAL, uint48(block.timestamp - 1), "T", "D");
    }

    function test_CreateCampaign_RevertsIfDeadlineTooFar() public {
        uint48 tooFar = uint48(block.timestamp + 366 days);

        vm.prank(CREATOR);
        vm.expectRevert(CampaignFactory.CampaignFactory__DeadlineTooFar.selector);
        factory.createCampaign(GOAL, tooFar, "T", "D");
    }

    function test_CreateCampaign_MultipleCampaigns() public {
        vm.prank(CREATOR);
        factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "C1", "D1");

        vm.prank(CREATOR_2);
        factory.createCampaign(GOAL * 2, uint48(block.timestamp + DURATION), "C2", "D2");

        assertEq(factory.getCampaignCount(), 2);
        assertEq(factory.getCampaignsByCreator(CREATOR).length, 1);
        assertEq(factory.getCampaignsByCreator(CREATOR_2).length, 1);
    }

    /*//////////////////////////////////////////////////////////////
                       ADMIN FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    function test_SetPlatformFee_UpdatesFee() public {
        vm.prank(ADMIN);
        factory.setPlatformFee(500); // 5%

        assertEq(factory.s_platformFeeBps(), 500);
    }

    function test_SetPlatformFee_EmitsPlatformFeeUpdated() public {
        vm.prank(ADMIN);
        vm.expectEmit(false, false, false, true);
        emit PlatformFeeUpdated(FEE_BPS, 500);
        factory.setPlatformFee(500);
    }

    function test_SetPlatformFee_RevertsIfExceedsMax() public {
        vm.prank(ADMIN);
        vm.expectRevert(CampaignFactory.CampaignFactory__InvalidFee.selector);
        factory.setPlatformFee(1001);
    }

    function test_SetPlatformFee_RevertsIfNotAdmin() public {
        vm.prank(ATTACKER);
        vm.expectRevert();
        factory.setPlatformFee(500);
    }

    function test_SetFeeRecipient_UpdatesRecipient() public {
        vm.prank(ADMIN);
        factory.setFeeRecipient(NEW_FEE_RECIPIENT);

        assertEq(factory.s_feeRecipient(), NEW_FEE_RECIPIENT);
    }

    function test_SetFeeRecipient_RevertsIfZeroAddress() public {
        vm.prank(ADMIN);
        vm.expectRevert(CampaignFactory.CampaignFactory__ZeroAddress.selector);
        factory.setFeeRecipient(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                   OPERATOR FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    function test_CancelCampaign_OperatorCanCancel() public {
        vm.prank(CREATOR);
        address campaignAddr = factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "T", "D");

        vm.prank(OPERATOR);
        factory.cancelCampaign(campaignAddr);

        CrowdfundingCampaign camp = CrowdfundingCampaign(payable(campaignAddr));
        assertEq(uint8(camp.s_state()), uint8(CrowdfundingCampaign.CampaignState.CANCELLED));
    }

    function test_CancelCampaign_RevertsIfNotACampaign() public {
        vm.prank(OPERATOR);
        vm.expectRevert(CampaignFactory.CampaignFactory__NotACampaign.selector);
        factory.cancelCampaign(ATTACKER);
    }

    function test_CancelCampaign_RevertsIfNotOperator() public {
        vm.prank(CREATOR);
        address campaignAddr = factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "T", "D");

        vm.prank(ATTACKER);
        vm.expectRevert();
        factory.cancelCampaign(campaignAddr);
    }

    /*//////////////////////////////////////////////////////////////
                       PAUSABLE TESTS
    //////////////////////////////////////////////////////////////*/
    function test_PauseFactory_PreventsNewCampaigns() public {
        vm.prank(OPERATOR);
        factory.pauseFactory();

        vm.prank(CREATOR);
        vm.expectRevert(); // Pausable: paused
        factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "T", "D");
    }

    function test_UnpauseFactory_AllowsNewCampaigns() public {
        vm.prank(OPERATOR);
        factory.pauseFactory();

        vm.prank(OPERATOR);
        factory.unpauseFactory();

        vm.prank(CREATOR); // should not revert
        factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "T", "D");
    }

    /*//////////////////////////////////////////////////////////////
                      PAGINATION TESTS
    //////////////////////////////////////////////////////////////*/
    function test_GetCampaignsPaginated_ReturnsCorrectSlice() public {
        // Create 5 campaigns
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(CREATOR);
            factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "T", "D");
        }

        address[] memory page = factory.getCampaignsPaginated(1, 2); // offset=1, limit=2
        assertEq(page.length, 2);
    }

    function test_GetCampaignsPaginated_EmptyIfOffsetBeyondEnd() public {
        vm.prank(CREATOR);
        factory.createCampaign(GOAL, uint48(block.timestamp + DURATION), "T", "D");

        address[] memory page = factory.getCampaignsPaginated(10, 5); // way past the end
        assertEq(page.length, 0);
    }

    /*//////////////////////////////////////////////////////////////
                          FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    function testFuzz_CreateCampaign_AnyValidGoalWorks(uint256 goal) public {
        goal = bound(goal, 1, type(uint128).max);

        vm.prank(CREATOR);
        address campaignAddr = factory.createCampaign(goal, uint48(block.timestamp + 1 days), "T", "D");

        assertTrue(factory.s_isCampaign(campaignAddr));
        assertEq(CrowdfundingCampaign(payable(campaignAddr)).i_goal(), goal);
    }

    function testFuzz_SetPlatformFee_AnyValidFee(uint16 feeBps) public {
        feeBps = uint16(bound(feeBps, 0, 1000)); // max 10%

        vm.prank(ADMIN);
        factory.setPlatformFee(feeBps);

        assertEq(factory.s_platformFeeBps(), feeBps);
    }
}
