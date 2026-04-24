# =============================================================================
#  Crowdfunding DAO — Makefile
#  Uses cast wallet (encrypted keystores) — no raw private keys anywhere.
# =============================================================================
#
#  FIRST TIME SETUP:
#  -----------------
#  # 1. Import Anvil default key (local dev only)
#  cast wallet import anvil0 \
#      --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
#
#  # 2. Import your real key (testnet / mainnet)
#  cast wallet import mykey --interactive
#     → it will prompt for the private key and a password to encrypt it
#
#  # 3. List your wallets
#  cast wallet list
#
#  USAGE:
#  ------
#  make deploy-local             # Deploy to local Anvil
#  make deploy-sepolia           # Deploy to Sepolia + verify on Etherscan
#  make test                     # Run all tests
#  make test-v                   # Run all tests verbose
#  make test-gas                 # Gas report
#  make test-unit                # Unit tests only
#  make test-fuzz                # Fuzz tests only
#  make test-invariant           # Invariant tests only
#  make coverage                 # Coverage report
#  make anvil                    # Start local Anvil node
#  make clean                    # Clean build artifacts
#
# =============================================================================

-include .env

# ── Wallet accounts ──────────────────────────────────────────────────────────
# Set your cast wallet account names here, or override via env vars:
#   CAST_WALLET_LOCAL=anvil0 make deploy-local
CAST_WALLET_LOCAL   ?= anvil0
CAST_WALLET_SEPOLIA ?= mykey

# ── RPC URLs ─────────────────────────────────────────────────────────────────
ANVIL_RPC     := http://localhost:8545
SEPOLIA_RPC   ?= $(SEPOLIA_RPC_URL)

# ── Forge flags ──────────────────────────────────────────────────────────────
FORGE_FLAGS   := -vvvv
FUZZ_RUNS     := 1000
INVARIANT_RUNS:= 256

# =============================================================================
#  BUILD
# =============================================================================

.PHONY: build
build:
	forge build

.PHONY: clean
clean:
	forge clean

# =============================================================================
#  TESTS
# =============================================================================

.PHONY: test
test:
	forge test

.PHONY: test-v
test-v:
	forge test -vvvv

.PHONY: test-unit
test-unit:
	forge test --match-path "test/unit/*" -vvv

.PHONY: test-fuzz
test-fuzz:
	forge test --match-test "testFuzz" --fuzz-runs $(FUZZ_RUNS) -vvv

.PHONY: test-invariant
test-invariant:
	forge test --match-path "test/invariant/*" -vvv

.PHONY: test-gas
test-gas:
	forge test --gas-report

.PHONY: snapshot
snapshot:
	forge snapshot

.PHONY: coverage
coverage:
	forge coverage --report lcov
	@echo "Coverage report written to lcov.info"

# =============================================================================
#  LOCAL ANVIL
# =============================================================================

# .PHONY: anvil
# anvil:
# 	anvil --block-time 1

## deploy-local: Deploy to local Anvil using cast wallet account 'anvil0'
## Requires: cast wallet import anvil0 --private-key 0xac0974...
# .PHONY: deploy-local
# deploy-local:
#     @echo "Starting Anvil and deploying locally..."
#     @forge script script/DeployAll.s.sol:DeployAll \
#         --rpc-url http://localhost:8545 \
#         --private-key $(DEFAULT_ANVIL_KEY) \
#         --broadcast \
#         -vvvv

# =============================================================================
#  SEPOLIA TESTNET
# =============================================================================

## deploy-sepolia: Deploy to Sepolia + verify on Etherscan
## Requires:
##   - cast wallet import mykey --interactive
##   - .env with: SEPOLIA_RPC_URL, ETHERSCAN_API_KEY, ADMIN_ADDRESS, FEE_RECIPIENT_ADDRESS
.PHONY: deploy-sepolia
deploy-sepolia:
	@echo "🚀 Deploying to Sepolia with account: $(CAST_WALLET_SEPOLIA)"
	@forge script script/DeployAll.s.sol:DeployAll \
		--rpc-url $(RPC_URL_SEPOLIA) \
		--account $(CAST_WALLET_SEPOLIA) \
		--broadcast \
		--verify \
		--etherscan-api-key $(ETHERSCAN_API_KEY) \
		--slow -vvvv
# deploy-sepolia:
# 	@forge script script/Deploy.s.sol \
# 		--rpc-url $(SEPOLIA_RPC_URL) \
# 		--account $(ACCOUNT) \
# 		--sender $(DEPLOYER_ADDRESS) \
# 		--broadcast --verify \
# 		--etherscan-api-key $(ETHERSCAN_API_KEY) \
# 		--slow -vvvv
# =============================================================================
#  UTILITIES
# =============================================================================

## wallet-list: Show all cast wallets
.PHONY: wallet-list
wallet-list:
	cast wallet list

## wallet-setup-anvil: Import Anvil default key as 'anvil0'
.PHONY: wallet-setup-anvil
wallet-setup-anvil:
	cast wallet import anvil0 \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

## wallet-new: Create a new encrypted keystore interactively
.PHONY: wallet-new
wallet-new:
	@read -p "Enter wallet name: " NAME; \
	cast wallet import $$NAME --interactive

## format: Format Solidity files
.PHONY: format
format:
	forge fmt

## lint: Check formatting
.PHONY: lint
lint:
	forge fmt --check

## sizes: Show contract sizes
.PHONY: sizes
sizes:
	forge build --sizes

# =============================================================================
#  HELP
# =============================================================================

.PHONY: help
help:
	@echo ""
	@echo "  Crowdfunding DAO — Makefile commands"
	@echo "  ─────────────────────────────────────"
	@echo "  make build              Build contracts"
	@echo "  make test               Run all tests"
	@echo "  make test-v             Run tests (verbose)"
	@echo "  make test-unit          Unit tests only"
	@echo "  make test-fuzz          Fuzz tests only"
	@echo "  make test-invariant     Invariant tests only"
	@echo "  make test-gas           Gas report"
	@echo "  make coverage           Coverage report"
	@echo "  make anvil              Start local Anvil"
	@echo "  make deploy-local       Deploy to Anvil"
	@echo "  make deploy-sepolia     Deploy to Sepolia + verify"
	@echo "  make wallet-list        Show cast wallets"
	@echo "  make wallet-setup-anvil Import Anvil default key"
	@echo "  make wallet-new         Create new encrypted keystore"
	@echo "  make format             Format Solidity"
	@echo "  make sizes              Contract sizes"
	@echo "  make clean              Clean build"
	@echo ""

.DEFAULT_GOAL := help