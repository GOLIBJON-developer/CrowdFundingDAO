// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {FundToken} from "../../src/FundToken.sol";

/// @title FundTokenTest — Unit + Fuzz tests for FundToken
/// @dev Cyfrin test style: descriptive names, makeAddr(), vm.prank()
contract FundTokenTest is Test {
    /*//////////////////////////////////////////////////////////////
                                SETUP
    //////////////////////////////////////////////////////////////*/
    FundToken token;

    address ADMIN = makeAddr("admin");
    address MINTER = makeAddr("minter"); // simulates a Campaign
    address BURNER = makeAddr("burner"); // simulates a Campaign
    address USER = makeAddr("user");
    address ATTACKER = makeAddr("attacker");

    event MinterGranted(address indexed campaign);
    event MinterRevoked(address indexed campaign);

    function setUp() public {
        vm.prank(ADMIN);
        token = new FundToken(ADMIN);

        // Grant roles to simulated campaign (MINTER + BURNER)
        vm.startPrank(ADMIN);
        token.grantRole(token.MINTER_ROLE(), MINTER);
        token.grantRole(token.BURNER_ROLE(), BURNER);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Constructor_SetsAdminRole() public view {
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), ADMIN));
    }

    function test_Constructor_RevertsIfZeroAdmin() public {
        vm.expectRevert(FundToken.FundToken__ZeroAddress.selector);
        new FundToken(address(0));
    }

    function test_Constructor_CorrectNameAndSymbol() public view {
        assertEq(token.name(), "FundToken");
        assertEq(token.symbol(), "FUND");
    }

    function test_Constructor_TotalSupplyIsZero() public view {
        assertEq(token.totalSupply(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                            MINT TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Mint_RevertsIfNotMinter() public {
        vm.prank(ATTACKER);
        vm.expectRevert(); // AccessControl revert
        token.mint(USER, 1 ether);
    }

    function test_Mint_MintsCorrectAmount() public {
        vm.prank(MINTER);
        token.mint(USER, 1 ether);
        assertEq(token.balanceOf(USER), 1 ether);
    }

    function test_Mint_UpdatesTotalSupply() public {
        vm.prank(MINTER);
        token.mint(USER, 5 ether);
        assertEq(token.totalSupply(), 5 ether);
    }

    function test_Mint_AutoDelegatesOnFirstMint() public {
        // User has never delegated — after mint, should have voting power
        vm.prank(MINTER);
        token.mint(USER, 1 ether);

        // Votes are checkpointed — need to move 1 block forward
        vm.roll(block.number + 1);
        // After auto-delegation, user should have their own votes
        // Note: auto-delegate happens in FundToken.mint() via _delegate
        assertEq(token.delegates(USER), USER); // auto self-delegated
    }

    function test_Mint_AddsVotingPower() public {
        vm.prank(MINTER);
        token.mint(USER, 3 ether);
        vm.roll(block.number + 1);
        assertEq(token.getVotes(USER), 3 ether);
    }

    /*//////////////////////////////////////////////////////////////
                           BURNFROM TESTS
    //////////////////////////////////////////////////////////////*/
    function test_BurnFrom_RevertsIfNotBurner() public {
        vm.prank(MINTER);
        token.mint(USER, 1 ether);

        vm.prank(ATTACKER);
        vm.expectRevert();
        token.burnFrom(USER, 1 ether);
    }

    function test_BurnFrom_BurnsCorrectAmount() public {
        vm.prank(MINTER);
        token.mint(USER, 5 ether);

        vm.prank(BURNER);
        token.burnFrom(USER, 2 ether);

        assertEq(token.balanceOf(USER), 3 ether);
        assertEq(token.totalSupply(), 3 ether);
    }

    function test_BurnFrom_DoesNotRequireApproval() public {
        // Key test: BURNER_ROLE bypasses allowance — USER doesn't need to approve
        vm.prank(MINTER);
        token.mint(USER, 1 ether);

        // USER has given zero allowance to BURNER
        assertEq(token.allowance(USER, BURNER), 0);

        // But BURNER can still burn due to role
        vm.prank(BURNER);
        token.burnFrom(USER, 1 ether); // should not revert

        assertEq(token.balanceOf(USER), 0);
    }

    function test_BurnFrom_RemovesVotingPower() public {
        vm.prank(MINTER);
        token.mint(USER, 3 ether);
        vm.roll(block.number + 1);

        vm.prank(BURNER);
        token.burnFrom(USER, 2 ether);
        vm.roll(block.number + 1);

        assertEq(token.getVotes(USER), 1 ether);
    }

    /*//////////////////////////////////////////////////////////////
                      GRANT/REVOKE CAMPAIGN ROLES
    //////////////////////////////////////////////////////////////*/
    function test_GrantCampaignRoles_GrantsBothRoles() public {
        address campaign = makeAddr("campaign");

        vm.prank(ADMIN);
        token.grantCampaignRoles(campaign);

        assertTrue(token.hasRole(token.MINTER_ROLE(), campaign));
        assertTrue(token.hasRole(token.BURNER_ROLE(), campaign));
    }

    function test_GrantCampaignRoles_EmitsMinterGranted() public {
        address campaign = makeAddr("campaign");

        vm.prank(ADMIN);
        vm.expectEmit(true, false, false, false);
        emit MinterGranted(campaign);
        token.grantCampaignRoles(campaign);
    }

    function test_GrantCampaignRoles_RevertsIfNotAdmin() public {
        vm.prank(ATTACKER);
        vm.expectRevert();
        token.grantCampaignRoles(makeAddr("campaign"));
    }

    function test_RevokeCampaignRoles_RevokesRoles() public {
        address campaign = makeAddr("campaign");

        vm.startPrank(ADMIN);
        token.grantCampaignRoles(campaign);
        token.revokeCampaignRoles(campaign);
        vm.stopPrank();

        assertFalse(token.hasRole(token.MINTER_ROLE(), campaign));
        assertFalse(token.hasRole(token.BURNER_ROLE(), campaign));
    }

    function test_RevokeCampaignRoles_EmitsMinterRevoked() public {
        address campaign = makeAddr("campaign");

        vm.startPrank(ADMIN);
        token.grantCampaignRoles(campaign);

        vm.expectEmit(true, false, false, false);
        emit MinterRevoked(campaign);
        token.revokeCampaignRoles(campaign);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                           VOTES TESTS
    //////////////////////////////////////////////////////////////*/
    function test_Votes_DelegateAndGetVotes() public {
        vm.prank(MINTER);
        token.mint(USER, 10 ether);

        vm.prank(USER);
        token.delegate(USER);

        vm.roll(block.number + 1);
        assertEq(token.getVotes(USER), 10 ether);
    }

    function test_Votes_DelegateToAnother() public {
        address DELEGATE = makeAddr("delegate");

        vm.prank(MINTER);
        token.mint(USER, 5 ether);

        vm.prank(USER);
        token.delegate(DELEGATE);

        vm.roll(block.number + 1);
        assertEq(token.getVotes(DELEGATE), 5 ether);
        assertEq(token.getVotes(USER), 0);
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    function testFuzz_Mint_AnyAmountWorks(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max); // realistic bounds

        vm.prank(MINTER);
        token.mint(USER, amount);

        assertEq(token.balanceOf(USER), amount);
        assertEq(token.totalSupply(), amount);
    }

    function testFuzz_BurnFrom_CannotExceedBalance(uint256 mintAmount, uint256 burnAmount) public {
        mintAmount = bound(mintAmount, 1, type(uint128).max);
        burnAmount = bound(burnAmount, mintAmount + 1, type(uint256).max);

        vm.prank(MINTER);
        token.mint(USER, mintAmount);

        vm.prank(BURNER);
        vm.expectRevert(); // ERC20: burn amount exceeds balance
        token.burnFrom(USER, burnAmount);
    }

    function testFuzz_BalanceAlwaysEqualsTotalSupply_SingleUser(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(MINTER);
        token.mint(USER, amount);

        // Single user: balance == totalSupply
        assertEq(token.balanceOf(USER), token.totalSupply());
    }
}
