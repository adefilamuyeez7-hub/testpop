// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPopupReferralTracker {
    function markCommissionAsPaid(uint256 purchaseId) external;
}

/**
 * @title PopupPayoutDistributor
 * @notice Handles creator payouts with fees, royalties, and escrow
 * @dev Ensures fair distribution between:
 *   - Creator (primary artist)
 *   - Platform (commission)
 *   - Collaborators (optional split)
 */
contract PopupPayoutDistributor is Ownable, ReentrancyGuard {
    uint256 public constant BPS_DIVISOR = 10_000;
    uint256 public constant AFFILIATE_COMMISSION_BPS = 500; // 5%
    // ═══════════════════════════════════════════════════════════════════════════
    // TYPE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════════════

    struct PayoutRecord {
        address creator;
        uint256 amount;
        string reason;
        uint256 timestamp;
        bool completed;
    }

    enum PayoutMethod {
        ETH,
        USDC,
        USDT,
        ESCROW
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════

    // Payout records for audit trail
    mapping(uint256 => PayoutRecord) public payoutRecords;
    uint256 public payoutRecordCounter;

    // Escrow for pending payouts
    mapping(address => uint256) public creatorEscrow;
    mapping(address => uint256) public platformEscrow;

    // Creator settings
    mapping(address => PayoutMethod) public creatorPayoutMethod;
    mapping(address => address) public creatorPayoutAddress; // where to send funds
    mapping(address => bool) public creatorBankingVerified;

    // Collaborators (artists can split payouts with team members)
    mapping(address => address[]) public creatorCollaborators;
    mapping(address => mapping(address => uint256)) public collaboratorShares; // bps

    // Payment tokens
    mapping(PayoutMethod => address) public paymentTokens;

    // Platform settings
    uint256 public platformCommission = 250; // 2.5% in basis points
    address public platformFeeRecipient;
    IPopupReferralTracker public referralManager;

    // Authorized callers (like ProductStore contract)
    mapping(address => bool) public authorizedCallers;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event PayoutDistributed(
        uint256 indexed payoutId,
        address indexed creator,
        uint256 amount,
        string reason
    );

    event PayoutDeferred(
        address indexed creator,
        uint256 amount,
        string reason
    );

    event CreatorPayoutMethodSet(
        address indexed creator,
        PayoutMethod method,
        address payoutAddress
    );

    event CollaboratorAdded(
        address indexed creator,
        address indexed collaborator,
        uint256 share
    );

    event CollaboratorRemoved(
        address indexed creator,
        address indexed collaborator
    );

    event EscrowReleased(
        address indexed creator,
        uint256 amount,
        PayoutMethod method
    );

    event SalePayoutDistributed(
        uint256 indexed payoutId,
        address indexed creator,
        address indexed affiliate,
        uint256 grossAmount,
        uint256 creatorNetAmount,
        uint256 platformFeeAmount,
        uint256 affiliateFeeAmount,
        PayoutMethod method,
        string reason
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _usdc,
        address _usdt,
        address _platformFeeRecipient
    ) {
        paymentTokens[PayoutMethod.USDC] = _usdc;
        paymentTokens[PayoutMethod.USDT] = _usdt;
        platformFeeRecipient = _platformFeeRecipient;
        payoutRecordCounter = 1;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAYOUT DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Distribute payout to creator (called by ProductStore)
     * @param creator Creator address
     * @param amount Amount to distribute
     * @param reason Reason for payout (sale, auction, etc)
     */
    function distributePayout(
        address creator,
        uint256 amount,
        string memory reason
    ) external payable nonReentrant {
        require(authorizedCallers[msg.sender], "Not authorized");
        require(creator != address(0), "Invalid creator");
        require(amount > 0, "Amount must be > 0");

        // Get creator payout method
        PayoutMethod method = creatorPayoutMethod[creator];

        // If creator hasn't set payout method, hold in escrow
        if (method == PayoutMethod.ESCROW || creatorPayoutAddress[creator] == address(0)) {
            _holdInEscrow(creator, amount);
            emit PayoutDeferred(creator, amount, reason);
            return;
        }

        // Get payout recipient (creator or delegated address)
        address recipient = creatorPayoutAddress[creator] != address(0)
            ? creatorPayoutAddress[creator]
            : creator;

        // Distribute to collaborators if any
        if (creatorCollaborators[creator].length > 0) {
            _distributeWithCollaborators(creator, recipient, amount, method);
        } else {
            // Direct payout
            _sendPayout(recipient, amount, method);
        }

        // Record payout
        uint256 recordId = payoutRecordCounter++;
        payoutRecords[recordId] = PayoutRecord({
            creator: creator,
            amount: amount,
            reason: reason,
            timestamp: block.timestamp,
            completed: true
        });

        emit PayoutDistributed(recordId, creator, amount, reason);
    }

    /**
     * @notice Distribute primary sale or auction proceeds in the asset actually received
     * @dev Authorized sales contracts can forward ETH directly or approve token pull.
     */
    function distributeSaleProceeds(
        address creator,
        address affiliate,
        uint256 grossAmount,
        PayoutMethod saleMethod,
        uint256 referralPurchaseId,
        string memory reason
    ) external payable nonReentrant returns (uint256 payoutId) {
        require(authorizedCallers[msg.sender], "Not authorized");
        require(creator != address(0), "Invalid creator");
        require(grossAmount > 0, "Amount must be > 0");

        if (saleMethod == PayoutMethod.ETH) {
            require(msg.value == grossAmount, "Incorrect ETH supplied");
        } else {
            require(msg.value == 0, "ETH not expected");
            address token = paymentTokens[saleMethod];
            require(token != address(0), "Token not configured");
            bool received = IERC20(token).transferFrom(msg.sender, address(this), grossAmount);
            require(received, "Token funding failed");
        }

        uint256 platformFeeAmount = (grossAmount * platformCommission) / BPS_DIVISOR;
        uint256 affiliateFeeAmount = affiliate == address(0)
            ? 0
            : (grossAmount * AFFILIATE_COMMISSION_BPS) / BPS_DIVISOR;
        uint256 creatorNetAmount = grossAmount - platformFeeAmount - affiliateFeeAmount;

        if (platformFeeAmount > 0 && platformFeeRecipient != address(0)) {
            _sendSalePayout(platformFeeRecipient, platformFeeAmount, saleMethod);
        }

        if (affiliateFeeAmount > 0) {
            _sendSalePayout(affiliate, affiliateFeeAmount, saleMethod);
            if (address(referralManager) != address(0) && referralPurchaseId != 0) {
                referralManager.markCommissionAsPaid(referralPurchaseId);
            }
        }

        address recipient = creatorPayoutAddress[creator] != address(0)
            ? creatorPayoutAddress[creator]
            : creator;

        if (creatorCollaborators[creator].length > 0) {
            _distributeSaleWithCollaborators(creator, recipient, creatorNetAmount, saleMethod);
        } else {
            _sendSalePayout(recipient, creatorNetAmount, saleMethod);
        }

        payoutId = payoutRecordCounter++;
        payoutRecords[payoutId] = PayoutRecord({
            creator: creator,
            amount: creatorNetAmount,
            reason: reason,
            timestamp: block.timestamp,
            completed: true
        });

        emit SalePayoutDistributed(
            payoutId,
            creator,
            affiliate,
            grossAmount,
            creatorNetAmount,
            platformFeeAmount,
            affiliateFeeAmount,
            saleMethod,
            reason
        );
    }

    /**
     * @notice Retrieve deferred payouts (held in escrow)
     */
    function retrieveEscrowPayout(PayoutMethod method) external nonReentrant {
        uint256 amount = creatorEscrow[msg.sender];
        require(amount > 0, "No escrow balance");

        creatorEscrow[msg.sender] = 0;
        _sendPayout(msg.sender, amount, method);

        emit EscrowReleased(msg.sender, amount, method);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // COLLABORATOR SPLITS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Add a collaborator to share payouts
     * @param collaborator Collaborator address
     * @param shareBps Share in basis points (1000 = 10%)
     */
    function addCollaborator(address collaborator, uint256 shareBps) external {
        require(collaborator != address(0), "Invalid collaborator");
        require(shareBps > 0 && shareBps <= 10000, "Invalid share");

        // Check total shares don't exceed 100%
        uint256 totalShares = shareBps;
        for (uint256 i = 0; i < creatorCollaborators[msg.sender].length; i++) {
            totalShares += collaboratorShares[msg.sender][creatorCollaborators[msg.sender][i]];
        }
        require(totalShares <= 10000, "Total shares exceed 100%");

        // Add collaborator if not already present
        bool exists = false;
        for (uint256 i = 0; i < creatorCollaborators[msg.sender].length; i++) {
            if (creatorCollaborators[msg.sender][i] == collaborator) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            creatorCollaborators[msg.sender].push(collaborator);
        }

        collaboratorShares[msg.sender][collaborator] = shareBps;

        emit CollaboratorAdded(msg.sender, collaborator, shareBps);
    }

    /**
     * @notice Remove a collaborator
     */
    function removeCollaborator(address collaborator) external {
        require(collaboratorShares[msg.sender][collaborator] > 0, "Collaborator not found");

        collaboratorShares[msg.sender][collaborator] = 0;

        // Remove from array
        for (uint256 i = 0; i < creatorCollaborators[msg.sender].length; i++) {
            if (creatorCollaborators[msg.sender][i] == collaborator) {
                creatorCollaborators[msg.sender][i] = creatorCollaborators[msg.sender][
                    creatorCollaborators[msg.sender].length - 1
                ];
                creatorCollaborators[msg.sender].pop();
                break;
            }
        }

        emit CollaboratorRemoved(msg.sender, collaborator);
    }

    /**
     * @notice Get collaborators for creator
     */
    function getCollaborators(address creator)
        external
        view
        returns (address[] memory)
    {
        return creatorCollaborators[creator];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CREATOR SETTINGS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Set creator payout method and address
     * @param method Payout method (ETH, USDC, USDT, ESCROW)
     * @param payoutAddress Where to send funds (optional, defaults to caller)
     */
    function setPayoutMethod(PayoutMethod method, address payoutAddress) external {
        creatorPayoutMethod[msg.sender] = method;

        // Allow delegation to another address
        if (payoutAddress != address(0) && payoutAddress != msg.sender) {
            creatorPayoutAddress[msg.sender] = payoutAddress;
        } else {
            creatorPayoutAddress[msg.sender] = address(0);
        }

        emit CreatorPayoutMethodSet(msg.sender, method, payoutAddress);
    }

    /**
     * @notice Verify creator banking details (stub for future)
     */
    function verifyBankingDetails() external {
        creatorBankingVerified[msg.sender] = true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Hold payout in escrow
     */
    function _holdInEscrow(address creator, uint256 amount) internal {
        creatorEscrow[creator] += amount;
    }

    /**
     * @notice Distribute payout with collaborator splits
     */
    function _distributeWithCollaborators(
        address creator,
        address recipient,
        uint256 amount,
        PayoutMethod method
    ) internal {
        uint256 creatorShare = amount;

        // Distribute to collaborators first
        for (uint256 i = 0; i < creatorCollaborators[creator].length; i++) {
            address collaborator = creatorCollaborators[creator][i];
            uint256 collaboratorShare = collaboratorShares[creator][collaborator];

            if (collaboratorShare > 0) {
                uint256 payAmount = (amount * collaboratorShare) / 10000;
                _sendPayout(collaborator, payAmount, method);
                creatorShare -= payAmount;
            }
        }

        // Send remaining to creator
        _sendPayout(recipient, creatorShare, method);
    }

    function _distributeSaleWithCollaborators(
        address creator,
        address recipient,
        uint256 amount,
        PayoutMethod method
    ) internal {
        uint256 creatorShare = amount;

        for (uint256 i = 0; i < creatorCollaborators[creator].length; i++) {
            address collaborator = creatorCollaborators[creator][i];
            uint256 collaboratorShare = collaboratorShares[creator][collaborator];

            if (collaboratorShare > 0) {
                uint256 payAmount = (amount * collaboratorShare) / BPS_DIVISOR;
                _sendSalePayout(collaborator, payAmount, method);
                creatorShare -= payAmount;
            }
        }

        _sendSalePayout(recipient, creatorShare, method);
    }

    /**
     * @notice Send payout in specified method
     */
    function _sendPayout(
        address recipient,
        uint256 amount,
        PayoutMethod method
    ) internal {
        if (method == PayoutMethod.ETH) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else if (method == PayoutMethod.USDC || method == PayoutMethod.USDT) {
            address token = paymentTokens[method];
            require(token != address(0), "Token not configured");
            bool success = IERC20(token).transfer(recipient, amount);
            require(success, "Token transfer failed");
        } else if (method == PayoutMethod.ESCROW) {
            creatorEscrow[recipient] += amount;
        } else {
            revert("Invalid payout method");
        }
    }

    function _sendSalePayout(
        address recipient,
        uint256 amount,
        PayoutMethod method
    ) internal {
        if (method == PayoutMethod.ETH) {
            (bool success, ) = payable(recipient).call{value: amount}("");
            require(success, "ETH transfer failed");
        } else if (method == PayoutMethod.USDC || method == PayoutMethod.USDT) {
            address token = paymentTokens[method];
            require(token != address(0), "Token not configured");
            bool success = IERC20(token).transfer(recipient, amount);
            require(success, "Token transfer failed");
        } else {
            revert("Invalid sale method");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Authorize a contract as caller (e.g., ProductStore)
     */
    function authorizeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = true;
    }

    /**
     * @notice Revoke caller authorization
     */
    function revokeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
    }

    /**
     * @notice Update platform commission
     */
    function setPlatformCommission(uint256 bps) external onlyOwner {
        require(bps <= 1000, "Commission too high"); // Max 10%
        platformCommission = bps;
    }

    /**
     * @notice Update platform fee recipient
     */
    function setPlatformFeeRecipient(address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        platformFeeRecipient = recipient;
    }

    function setReferralManager(address referralManagerAddress) external onlyOwner {
        referralManager = IPopupReferralTracker(referralManagerAddress);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get payout record
     */
    function getPayoutRecord(uint256 recordId)
        external
        view
        returns (PayoutRecord memory)
    {
        return payoutRecords[recordId];
    }

    /**
     * @notice Get creator's escrow balance
     */
    function getCreatorEscrow(address creator) external view returns (uint256) {
        return creatorEscrow[creator];
    }

    /**
     * @notice Get total earnings for creator
     */
    function getCreatorPayoutMethod(address creator)
        external
        view
        returns (PayoutMethod)
    {
        return creatorPayoutMethod[creator];
    }

    receive() external payable {}
}
