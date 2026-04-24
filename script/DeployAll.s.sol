// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {FundToken} from "../src/FundToken.sol";
import {CampaignFactory} from "../src/CampaignFactory.sol";
import {CrowdfundingGovernor} from "../src/CrowdfundingGovernor.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {HelperConfig} from "./HelperConfig.s.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";

/*//////////////////////////////////////////////////////////////
          DEPLOYMENT ORDER — solving circular dependency
//////////////////////////////////////////////////////////////*/
//
//  Problem: FundToken needs Factory address as admin,
//           Factory needs FundToken address as constructor param.
//
//  Solution: two-phase init
//    1. Deploy FundToken  → deployer is temporary admin
//    2. Deploy Timelock   → empty proposers/executors (set in step 6)
//    3. Deploy Factory    → gets FundToken address
//    4. Grant Factory DEFAULT_ADMIN_ROLE on FundToken
//    5. Deploy Governor   → gets FundToken (IVotes) + Timelock
//    6. Wire Timelock     → Governor = PROPOSER + EXECUTOR
//    7. Wire Factory      → Timelock = admin + operator (DAO controls factory)
//    8. (optional) Deployer renounces all roles → fully decentralised
//
//  TRUST CHAIN after setup:
//    Token holders → Governor → Timelock → Factory → FundToken → Campaigns
//
//  HOW TO RUN (cast wallet — no private keys in scripts):
//
//    # Local Anvil
//    make deploy-local
//
//    # Sepolia
//    make deploy-sepolia
//
//  Makefile handles the --account flag. See Makefile for details.

/// @title DeployAll
/// @notice One-shot deployment of the full Crowdfunding DAO system.
contract DeployAll is Script {
    /*//////////////////////////////////////////////////////////////
                         TIMELOCK DELAY
    //////////////////////////////////////////////////////////////*/
    // 2 days delay between a passed proposal and execution.
    // Set to 0 for local Anvil if you want instant execution in tests.
    uint256 constant MIN_DELAY = 2 days;

    /*//////////////////////////////////////////////////////////////
                              RUN
    //////////////////////////////////////////////////////////////*/
    function run()
        external
        returns (
            FundToken fundToken,
            CampaignFactory factory,
            CrowdfundingGovernor governor,
            TimelockController timelock
        )
    {
        HelperConfig helperConfig = new HelperConfig();
        // getActiveNetworkConfig() returns a struct (not a tuple).
        // Using the old `public` variable caused "Different number of components" error.
        HelperConfig.NetworkConfig memory cfg = helperConfig.getActiveNetworkConfig();

        // vm.startBroadcast() with no args → forge uses the --account wallet from CLI.
        // No private keys stored in scripts or .env. Safe for all networks.
        vm.startBroadcast();

        /*──────────────────────────────────────────────────────────
          STEP 1 — FundToken
          msg.sender (the cast wallet account) is the temporary admin.
          We hand over this role to Factory in step 4.
        ──────────────────────────────────────────────────────────*/
        fundToken = new FundToken(cfg.admin);
        console.log("1. FundToken deployed:  ", address(fundToken));

        /*──────────────────────────────────────────────────────────
          STEP 2 — TimelockController
          proposers + executors are empty; roles are granted in step 6.
          msg.sender is temporary timelock admin (renounced in step 8).
        ──────────────────────────────────────────────────────────*/
        address[] memory emptyArr = new address[](0);
        timelock = new TimelockController(MIN_DELAY, emptyArr, emptyArr, cfg.admin);
        console.log("2. TimelockController:  ", address(timelock));

        /*──────────────────────────────────────────────────────────
          STEP 3 — CampaignFactory
          cfg.admin gets both DEFAULT_ADMIN_ROLE and OPERATOR_ROLE.
          cfg.feeRecipient receives platform fees on each withdrawal.
        ──────────────────────────────────────────────────────────*/
        factory = new CampaignFactory(address(fundToken), cfg.admin, cfg.feeRecipient, cfg.platformFeeBps);
        console.log("3. CampaignFactory:     ", address(factory));

        /*──────────────────────────────────────────────────────────
          STEP 4 — Grant Factory admin on FundToken
          Factory must be DEFAULT_ADMIN on FundToken so it can call
          grantCampaignRoles() / revokeCampaignRoles() for each campaign.
        ──────────────────────────────────────────────────────────*/
        fundToken.grantRole(fundToken.DEFAULT_ADMIN_ROLE(), address(factory));
        console.log("4. Factory granted DEFAULT_ADMIN_ROLE on FundToken");

        /*──────────────────────────────────────────────────────────
          STEP 5 — Governor
          Uses FundToken as the IVotes source (vote weight = FUND balance).
          Uses Timelock as the execution layer (adds delay after vote).
        ──────────────────────────────────────────────────────────*/
        governor = new CrowdfundingGovernor(IVotes(address(fundToken)), timelock);
        console.log("5. CrowdfundingGovernor:", address(governor));

        /*──────────────────────────────────────────────────────────
          STEP 6 — Wire Timelock roles
          PROPOSER  → Governor (only Governor can queue proposals)
          EXECUTOR  → Governor (only Governor can execute after delay)
          CANCELLER → cfg.admin (multisig safety valve — can cancel queued proposals)
        ──────────────────────────────────────────────────────────*/
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(governor));
        timelock.grantRole(timelock.CANCELLER_ROLE(), cfg.admin);
        console.log("6. Timelock roles wired (Governor = proposer + executor)");

        /*──────────────────────────────────────────────────────────
          STEP 7 — Grant Timelock admin + operator over Factory
          This means DAO votes can call:
            factory.setPlatformFee()     → change fees
            factory.setFeeRecipient()    → change treasury
            factory.cancelCampaign()     → cancel fraudulent campaign
            factory.pauseFactory()       → emergency stop
            factory.grantRole(...)       → access control changes
        ──────────────────────────────────────────────────────────*/
        factory.grantRole(factory.DEFAULT_ADMIN_ROLE(), address(timelock));
        factory.grantRole(factory.OPERATOR_ROLE(), address(timelock));
        console.log("7. Timelock granted admin+operator on Factory");

        /*──────────────────────────────────────────────────────────
          STEP 8 — Renounce deployer roles (uncomment for production)
          WARNING: after renouncing, ONLY DAO governance can make changes.
          Do this after you have verified everything works correctly.
        ──────────────────────────────────────────────────────────*/
        // timelock.renounceRole(timelock.DEFAULT_ADMIN_ROLE(), msg.sender);
        // fundToken.renounceRole(fundToken.DEFAULT_ADMIN_ROLE(), msg.sender);
        // factory.renounceRole(factory.DEFAULT_ADMIN_ROLE(), msg.sender);

        vm.stopBroadcast();

        /*──────────────────────────────────────────────────────────
          SUMMARY
        ──────────────────────────────────────────────────────────*/
        console.log("\n======= DEPLOYMENT COMPLETE =======");
        console.log("FundToken:       ", address(fundToken));
        console.log("CampaignFactory: ", address(factory));
        console.log("Governor:        ", address(governor));
        console.log("Timelock:        ", address(timelock));
        console.log("Admin:           ", cfg.admin);
        console.log("Fee Recipient:   ", cfg.feeRecipient);
        console.log("Platform Fee:    ", cfg.platformFeeBps, "bps");
        console.log("===================================");
    }
}
