// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PopupProductStore
 * @notice Unified smart contract for POPUP Platform Products/Drops
 * @dev Handles:
 *   - Product collection with automatic NFT minting
 *   - Gifting with recipient acceptance/rejection
 *   - English auctions with bidding
 *   - Multi-payment support (ETH, USDC, USDT)
 *   - Creator royalties and payouts
 */

interface IPayout {
    function distributePayout(
        address creator,
        uint256 amount,
        string memory reason
    ) external;

    function distributeSaleProceeds(
        address creator,
        address affiliate,
        uint256 grossAmount,
        uint8 paymentMethod,
        uint256 referralPurchaseId,
        string memory reason
    ) external payable returns (uint256 payoutId);
}

interface IReferralManager {
    function validateReferralCode(string calldata code) external view returns (bool isValid, address artist);

    function recordReferral(
        string calldata code,
        address referrer,
        address buyer,
        uint256 purchaseAmount,
        uint8 paymentMethod,
        uint256 purchaseId
    ) external returns (address artist, uint256 commission, bool recorded);

    function markCommissionAsPaid(uint256 purchaseId) external;

    function cancelReferral(uint256 purchaseId) external returns (bool cancelled);
}

contract PopupProductStore is ERC721, Ownable, ReentrancyGuard, Pausable {
    using Strings for uint256;

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════════════

    enum PaymentMethod {
        ETH,
        USDC,
        USDT
    }

    enum AuctionStatus {
        ACTIVE,
        SETTLED,
        CANCELLED
    }

    enum GiftStatus {
        PENDING,
        ACCEPTED,
        REJECTED,
        CLAIMED
    }

    struct Product {
        uint256 productId;
        address creator;
        string uri; // IPFS metadata URI
        uint256 priceWei;
        PaymentMethod paymentMethod;
        uint256 supply; // max copies (0 = unlimited)
        uint256 sold; // copies sold
        uint256 royaltyPercentBps; // basis points (250 = 2.5%)
        bool paused;
        uint256 createdAt;
    }

    struct Purchase {
        uint256 purchaseId;
        uint256 productId;
        address buyer;
        address creator;
        uint256 amount;
        PaymentMethod paymentMethod;
        uint256 nftTokenId;
        bool isGift;
        address giftRecipient;
        GiftStatus giftStatus;
        uint256 timestamp;
    }

    struct Auction {
        uint256 auctionId;
        uint256 productId;
        address creator;
        uint256 startPrice;
        address highestBidder;
        uint256 highestBid;
        uint256 startTime;
        uint256 endTime;
        AuctionStatus status;
        bytes32 ipfsMetadataHash;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        uint256 timestamp;
    }

    struct GiftClaim {
        address recipient;
        uint256 purchaseId;
        string recipientLabel; // for privacy (email, handle, etc)
        GiftStatus status;
        string claimCode; // TODO: implement claim verification
        uint256 createdAt;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════

    // Product management
    mapping(uint256 => Product) public products;
    uint256 public productCounter;

    // Purchase tracking
    mapping(uint256 => Purchase) public purchases;
    uint256 public purchaseCounter;

    // Auction system
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => Bid[]) public auctionBids;
    mapping(uint256 => mapping(address => uint256)) public auctionBidsPerBidder;
    uint256 public auctionCounter;

    // Gift system
    mapping(uint256 => GiftClaim) public giftClaims;
    mapping(address => uint256[]) public userGifts;

    // NFT tracking
    uint256 private tokenIdCounter;
    mapping(uint256 => uint256) public tokenIdToProductId; // NFT tokenId → productId
    mapping(uint256 => uint256) public tokenIdToPurchaseId; // NFT tokenId → purchaseId

    mapping(uint256 => address) public purchaseAffiliate; // purchaseId -> affiliate

    // Payment tokens
    mapping(PaymentMethod => address) public paymentTokens;

    // Payout handler
    IPayout public payoutHandler;
    IReferralManager public referralManager;

    // Creator registry
    mapping(address => bool) public creatorApproved;
    mapping(address => uint256) public creatorEarnings;

    // Auction configuration
    uint256 public minAuctionDuration = 1 days;
    uint256 public maxAuctionDuration = 30 days;

    // Platform fees
    uint256 public platformFeeBps = 250; // 2.5%
    address public platformFeeRecipient;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event ProductCreated(
        uint256 indexed productId,
        address indexed creator,
        string uri,
        uint256 price,
        PaymentMethod paymentMethod
    );

    event ProductPurchased(
        uint256 indexed purchaseId,
        uint256 indexed productId,
        address indexed buyer,
        uint256 amount,
        uint256 nftTokenId,
        bool isGift
    );

    event GiftCreated(
        uint256 indexed purchaseId,
        address indexed sender,
        address indexed recipient,
        string recipientLabel
    );

    event GiftClaimed(
        uint256 indexed purchaseId,
        address indexed recipient,
        GiftStatus status
    );

    event AuctionCreated(
        uint256 indexed auctionId,
        uint256 indexed productId,
        uint256 startPrice,
        uint256 duration
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount,
        uint256 bidCount
    );

    event AuctionSettled(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 finalPrice,
        uint256 nftTokenId
    );

    event CreatorApproved(address indexed creator);
    event CreatorRevoked(address indexed creator);
    event ReferralManagerUpdated(address indexed referralManager);

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR & INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(
        address _paymentTokenUsdc,
        address _paymentTokenUsdt,
        address _payoutHandler,
        address _platformFeeRecipient
    )
        ERC721("POPUP Products", "POPUP")
    {
        paymentTokens[PaymentMethod.USDC] = _paymentTokenUsdc;
        paymentTokens[PaymentMethod.USDT] = _paymentTokenUsdt;
        payoutHandler = IPayout(_payoutHandler);
        platformFeeRecipient = _platformFeeRecipient;
        tokenIdCounter = 1;
        productCounter = 1;
        purchaseCounter = 1;
        auctionCounter = 1;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRODUCT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new product listing
     * @param metadataUri IPFS metadata URI
     * @param priceWei Price in wei (or token units)
     * @param paymentMethod Payment method (ETH, USDC, USDT)
     * @param supply Max supply (0 = unlimited)
     * @param royaltyPercentBps Creator royalty in basis points
     */
    function createProduct(
        string memory metadataUri,
        uint256 priceWei,
        PaymentMethod paymentMethod,
        uint256 supply,
        uint256 royaltyPercentBps
    ) external returns (uint256 productId) {
        require(creatorApproved[msg.sender], "Creator not approved");
        require(priceWei > 0, "Price must be > 0");
        require(royaltyPercentBps <= 10000, "Royalty too high");

        productId = productCounter++;

        products[productId] = Product({
            productId: productId,
            creator: msg.sender,
            uri: metadataUri,
            priceWei: priceWei,
            paymentMethod: paymentMethod,
            supply: supply,
            sold: 0,
            royaltyPercentBps: royaltyPercentBps,
            paused: false,
            createdAt: block.timestamp
        });

        emit ProductCreated(productId, msg.sender, metadataUri, priceWei, paymentMethod);
    }

    /**
     * @notice Purchase a product directly
     * @param productId Product ID to purchase
     * @param quantity Number of copies
     * @param giftRecipient Address of gift recipient (0x0 = not a gift)
     */
    function purchaseProduct(
        uint256 productId,
        uint256 quantity,
        address giftRecipient
    ) external payable nonReentrant whenNotPaused returns (uint256 purchaseId) {
        return _purchaseProduct(productId, quantity, giftRecipient, "", address(0));
    }

    /**
     * @notice Purchase a product directly using a referral code
     * @param productId Product ID to purchase
     * @param quantity Number of copies
     * @param giftRecipient Address that should receive the soulbound NFT
     * @param referralCode Artist-scoped referral code
     * @param referrer Affiliate wallet to receive commission
     */
    function purchaseProductWithReferral(
        uint256 productId,
        uint256 quantity,
        address giftRecipient,
        string calldata referralCode,
        address referrer
    ) external payable nonReentrant whenNotPaused returns (uint256 purchaseId) {
        return _purchaseProduct(productId, quantity, giftRecipient, referralCode, referrer);
    }

    function _purchaseProduct(
        uint256 productId,
        uint256 quantity,
        address giftRecipient,
        string memory referralCode,
        address referrer
    ) internal returns (uint256 purchaseId) {
        require(quantity > 0, "Quantity must be > 0");
        require(quantity == 1, "Only single-copy purchases supported");

        Product storage product = products[productId];
        require(product.creator != address(0), "Product not found");
        require(!product.paused, "Product paused");
        require(product.supply == 0 || product.sold + quantity <= product.supply, "Insufficient supply");

        uint256 totalCost = product.priceWei * quantity;
        purchaseId = purchaseCounter++;
        address affiliate = _prepareReferral(
            product.creator,
            referralCode,
            referrer,
            totalCost,
            product.paymentMethod,
            purchaseId
        );

        // Collect payment into contract custody before routing payout splits.
        _processPayment(product.paymentMethod, address(this), totalCost, false);

        // Update product state
        product.sold += quantity;

        if (affiliate != address(0)) {
            purchaseAffiliate[purchaseId] = affiliate;
        }

        uint256 nftTokenId = 0;
        GiftStatus giftStatus = GiftStatus.CLAIMED;

        purchases[purchaseId] = Purchase({
            purchaseId: purchaseId,
            productId: productId,
            buyer: msg.sender,
            creator: product.creator,
            amount: totalCost,
            paymentMethod: product.paymentMethod,
            nftTokenId: nftTokenId,
            isGift: giftRecipient != address(0),
            giftRecipient: giftRecipient,
            giftStatus: giftStatus,
            timestamp: block.timestamp
        });

        if (giftRecipient == address(0)) {
            _distributePayout(
                product.creator,
                affiliate,
                totalCost,
                product.paymentMethod,
                affiliate != address(0) ? purchaseId : 0,
                "Product sale"
            );

            nftTokenId = _mintProductNFT(productId, msg.sender, purchaseId);
            purchases[purchaseId].nftTokenId = nftTokenId;
        } else {
            purchases[purchaseId].giftStatus = GiftStatus.PENDING;
            _createGift(purchaseId, msg.sender, giftRecipient, "");
        }

        emit ProductPurchased(purchaseId, productId, msg.sender, totalCost, nftTokenId, giftRecipient != address(0));

        return purchaseId;
    }

    function _prepareReferral(
        address creator,
        string memory referralCode,
        address referrer,
        uint256 totalCost,
        PaymentMethod paymentMethod,
        uint256 purchaseId
    ) internal returns (address affiliate) {
        if (bytes(referralCode).length == 0) {
            return address(0);
        }

        require(address(referralManager) != address(0), "Referral manager not configured");
        require(referrer != address(0), "Invalid referrer");
        require(referrer != msg.sender, "Self-referral not allowed");

        (bool isValid, address referralArtist) = referralManager.validateReferralCode(referralCode);
        require(isValid, "Invalid referral code");
        require(referralArtist == creator, "Referral code artist mismatch");

        (, , bool recorded) = referralManager.recordReferral(
            referralCode,
            referrer,
            msg.sender,
            totalCost,
            uint8(paymentMethod),
            purchaseId
        );

        return recorded ? referrer : address(0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AUCTION SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create an auction for a product
     * @param productId Product to auction
     * @param startPrice Starting bid price
     * @param durationSeconds Auction duration
     */
    function createAuction(
        uint256 productId,
        uint256 startPrice,
        uint256 durationSeconds
    ) external returns (uint256 auctionId) {
        require(creatorApproved[msg.sender], "Creator not approved");
        require(durationSeconds >= minAuctionDuration && durationSeconds <= maxAuctionDuration, "Invalid duration");

        Product storage product = products[productId];
        require(product.creator == msg.sender, "Not product creator");
        require(!product.paused, "Product paused");

        auctionId = auctionCounter++;

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            productId: productId,
            creator: msg.sender,
            startPrice: startPrice,
            highestBidder: address(0),
            highestBid: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + durationSeconds,
            status: AuctionStatus.ACTIVE,
            ipfsMetadataHash: keccak256(abi.encodePacked(product.uri))
        });

        emit AuctionCreated(auctionId, productId, startPrice, durationSeconds);
    }

    /**
     * @notice Place a bid on an auction
     * @param auctionId Auction ID
     * @param bidAmount Bid amount in wei
     */
    function placeBid(uint256 auctionId, uint256 bidAmount)
        external
        payable
        nonReentrant
        returns (uint256 bidIndex)
    {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(bidAmount > auction.highestBid, "Bid too low");
        require(bidAmount >= auction.startPrice, "Below start price");

        // Refund previous highest bidder
        if (auction.highestBidder != address(0)) {
            _refundBid(auction.highestBidder, auction.highestBid, auction.productId);
        }

        // Process payment for new bid
        Product storage product = products[auction.productId];
        _processPayment(product.paymentMethod, address(this), bidAmount, true);

        // Update auction state
        auction.highestBidder = msg.sender;
        auction.highestBid = bidAmount;
        auctionBidsPerBidder[auctionId][msg.sender] = bidAmount;

        // Record bid
        bidIndex = auctionBids[auctionId].length;
        auctionBids[auctionId].push(Bid({
            bidder: msg.sender,
            amount: bidAmount,
            timestamp: block.timestamp
        }));

        emit BidPlaced(auctionId, msg.sender, bidAmount, bidIndex + 1);
    }

    /**
     * @notice Settle auction and award to highest bidder
     * @param auctionId Auction to settle
     */
    function settleAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Auction not active");
        require(block.timestamp >= auction.endTime, "Auction not ended");

        auction.status = AuctionStatus.SETTLED;

        // If no bids, return
        if (auction.highestBidder == address(0)) {
            return;
        }

        // Award to highest bidder
        uint256 nftTokenId = _mintProductNFT(auction.productId, auction.highestBidder, 0);

        _distributePayout(
            auction.creator,
            address(0),
            auction.highestBid,
            products[auction.productId].paymentMethod,
            0,
            "Auction settlement"
        );

        emit AuctionSettled(auctionId, auction.highestBidder, auction.highestBid, nftTokenId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // GIFTING SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a gift from a purchase
     * @param purchaseId Purchase ID to gift
     * @param sender Sender address
     * @param recipient Recipient address
     * @param recipientLabel Privacy label (email hash, username, etc)
     */
    function createGift(
        uint256 purchaseId,
        address sender,
        address recipient,
        string memory recipientLabel
    ) external {
        require(msg.sender == sender || msg.sender == owner(), "Not authorized");

        Purchase storage purchase = purchases[purchaseId];
        require(purchase.purchaseId != 0, "Purchase not found");
        require(purchase.nftTokenId == 0, "Gift already minted");
        require(!purchase.isGift, "Already a gift");

        _createGift(purchaseId, sender, recipient, recipientLabel);

        purchase.isGift = true;
        purchase.giftRecipient = recipient;
        purchase.giftStatus = GiftStatus.PENDING;
    }

    /**
     * @notice Accept a gift
     * @param purchaseId Purchase ID
     */
    function acceptGift(uint256 purchaseId) external nonReentrant {
        Purchase storage purchase = purchases[purchaseId];
        require(purchase.purchaseId != 0, "Purchase not found");
        require(purchase.isGift, "Not a gift");
        require(purchase.giftRecipient == msg.sender, "Not gift recipient");
        require(purchase.giftStatus == GiftStatus.PENDING, "Gift not pending");
        require(purchase.nftTokenId == 0, "Gift already claimed");

        purchase.giftStatus = GiftStatus.ACCEPTED;
        GiftClaim storage gift = giftClaims[purchaseId];
        gift.status = GiftStatus.ACCEPTED;

        _distributePayout(
            purchase.creator,
            purchaseAffiliate[purchaseId],
            purchase.amount,
            purchase.paymentMethod,
            purchaseAffiliate[purchaseId] != address(0) ? purchaseId : 0,
            "Gift accepted"
        );

        uint256 nftTokenId = _mintProductNFT(purchase.productId, msg.sender, purchaseId);
        purchase.nftTokenId = nftTokenId;
        purchase.giftStatus = GiftStatus.CLAIMED;
        gift.status = GiftStatus.CLAIMED;

        emit GiftClaimed(purchaseId, msg.sender, GiftStatus.CLAIMED);
    }

    /**
     * @notice Reject a gift
     * @param purchaseId Purchase ID
     */
    function rejectGift(uint256 purchaseId) external nonReentrant {
        Purchase storage purchase = purchases[purchaseId];
        require(purchase.purchaseId != 0, "Purchase not found");
        require(purchase.isGift, "Not a gift");
        require(purchase.giftRecipient == msg.sender, "Not gift recipient");
        require(purchase.giftStatus == GiftStatus.PENDING, "Gift not pending");
        require(purchase.nftTokenId == 0, "Gift already claimed");

        purchase.giftStatus = GiftStatus.REJECTED;
        GiftClaim storage gift = giftClaims[purchaseId];
        gift.status = GiftStatus.REJECTED;

        if (address(referralManager) != address(0)) {
            referralManager.cancelReferral(purchaseId);
        }

        _refundPurchase(purchaseId);
        emit GiftClaimed(purchaseId, msg.sender, GiftStatus.REJECTED);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Mint NFT for product purchase
     */
    function _mintProductNFT(
        uint256 productId,
        address to,
        uint256 purchaseId
    ) internal returns (uint256 tokenId) {
        tokenId = tokenIdCounter++;
        tokenIdToProductId[tokenId] = productId;
        tokenIdToPurchaseId[tokenId] = purchaseId;

        // Mint ERC721 variant for unique products
        _safeMint(to, tokenId);
    }

    /**
     * @notice Process payment (ETH, USDC, USDT)
     */
    function _processPayment(
        PaymentMethod method,
        address recipient,
        uint256 amount,
        bool isAuctionBid
    ) internal {
        if (method == PaymentMethod.ETH) {
            require(msg.value == amount, "Incorrect ETH amount");
            if (!isAuctionBid && recipient != address(this)) {
                (bool success, ) = payable(recipient).call{value: amount}("");
                require(success, "ETH transfer failed");
            }
        } else if (method == PaymentMethod.USDC || method == PaymentMethod.USDT) {
            address token = paymentTokens[method];
            require(token != address(0), "Payment token not configured");
            bool success = IERC20(token).transferFrom(msg.sender, recipient, amount);
            require(success, "Token transfer failed");
        } else {
            revert("Invalid payment method");
        }
    }

    function _distributePayout(
        address creator,
        address affiliate,
        uint256 amount,
        PaymentMethod paymentMethod,
        uint256 referralPurchaseId,
        string memory reason
    ) internal {
        if (address(payoutHandler) != address(0)) {
            if (paymentMethod == PaymentMethod.ETH) {
                payoutHandler.distributeSaleProceeds{value: amount}(
                    creator,
                    affiliate,
                    amount,
                    uint8(paymentMethod),
                    referralPurchaseId,
                    reason
                );
            } else {
                address token = paymentTokens[paymentMethod];
                require(token != address(0), "Payment token not configured");
                require(IERC20(token).approve(address(payoutHandler), 0), "Token approval reset failed");
                require(IERC20(token).approve(address(payoutHandler), amount), "Token approval failed");
                payoutHandler.distributeSaleProceeds(
                    creator,
                    affiliate,
                    amount,
                    uint8(paymentMethod),
                    referralPurchaseId,
                    reason
                );
            }

            uint256 affiliateFee = affiliate == address(0) ? 0 : (amount * 500) / 10000;
            uint256 platformFee = (amount * platformFeeBps) / 10000;
            creatorEarnings[creator] += amount - platformFee - affiliateFee;
            return;
        }

        uint256 affiliateFeeAmount = affiliate == address(0) ? 0 : (amount * 500) / 10000;
        uint256 platformFeeAmount = (amount * platformFeeBps) / 10000;
        uint256 creatorShare = amount - platformFeeAmount - affiliateFeeAmount;

        if (platformFeeAmount > 0 && platformFeeRecipient != address(0)) {
            _sendFunds(platformFeeRecipient, platformFeeAmount, paymentMethod);
        }

        if (affiliateFeeAmount > 0) {
            _sendFunds(affiliate, affiliateFeeAmount, paymentMethod);
        }

        _sendFunds(creator, creatorShare, paymentMethod);
        if (referralPurchaseId != 0 && address(referralManager) != address(0)) {
            referralManager.markCommissionAsPaid(referralPurchaseId);
        }
        creatorEarnings[creator] += creatorShare;
    }

    function _sendFunds(address recipient, uint256 amount, PaymentMethod method) internal {
        if (method == PaymentMethod.ETH) {
            (bool ethSuccess, ) = payable(recipient).call{value: amount}("");
            require(ethSuccess, "ETH transfer failed");
            return;
        }

        address token = paymentTokens[method];
        require(token != address(0), "Payment token not configured");
        bool tokenSuccess = IERC20(token).transfer(recipient, amount);
        require(tokenSuccess, "Token transfer failed");
    }

    /**
     * @notice Refund a bid
     */
    function _refundBid(
        address bidder,
        uint256 amount,
        uint256 productId
    ) internal {
        Product storage product = products[productId];

        if (product.paymentMethod == PaymentMethod.ETH) {
            (bool success, ) = payable(bidder).call{value: amount}("");
            require(success, "Refund failed");
        } else {
            address token = paymentTokens[product.paymentMethod];
            bool success = IERC20(token).transfer(bidder, amount);
            require(success, "Token refund failed");
        }
    }

    /**
     * @notice Refund a purchase (for rejected gifts)
     */
    function _refundPurchase(uint256 purchaseId) internal {
        Purchase storage purchase = purchases[purchaseId];
        require(purchase.isGift, "Not a gift");

        if (purchase.paymentMethod == PaymentMethod.ETH) {
            (bool success, ) = payable(purchase.buyer).call{value: purchase.amount}("");
            require(success, "Refund failed");
        } else {
            address token = paymentTokens[purchase.paymentMethod];
            bool success = IERC20(token).transfer(purchase.buyer, purchase.amount);
            require(success, "Token refund failed");
        }
    }

    /**
     * @notice Create gift record
     */
    function _createGift(
        uint256 purchaseId,
        address sender,
        address recipient,
        string memory recipientLabel
    ) internal {
        Purchase storage purchase = purchases[purchaseId];
        purchase.isGift = true;
        purchase.giftRecipient = recipient;
        purchase.giftStatus = GiftStatus.PENDING;

        giftClaims[purchaseId] = GiftClaim({
            recipient: recipient,
            purchaseId: purchaseId,
            recipientLabel: recipientLabel,
            status: GiftStatus.PENDING,
            claimCode: "",
            createdAt: block.timestamp
        });

        userGifts[recipient].push(purchaseId);

        emit GiftCreated(purchaseId, sender, recipient, recipientLabel);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Approve a creator
     */
    function approveCreator(address creator) external onlyOwner {
        creatorApproved[creator] = true;
        emit CreatorApproved(creator);
    }

    /**
     * @notice Revoke creator approval
     */
    function revokeCreator(address creator) external onlyOwner {
        creatorApproved[creator] = false;
        emit CreatorRevoked(creator);
    }

    /**
     * @notice Pause/unpause contract
     */
    function togglePause() external onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    /**
     * @notice Pause a product
     */
    function pauseProduct(uint256 productId) external {
        Product storage product = products[productId];
        require(product.creator == msg.sender || msg.sender == owner(), "Not authorized");
        product.paused = true;
    }

    /**
     * @notice Update platform fee
     */
    function setPlatformFee(uint256 feeBps) external onlyOwner {
        require(feeBps <= 1000, "Fee too high"); // Max 10%
        platformFeeBps = feeBps;
    }

    function setPayoutHandler(address payoutHandlerAddress) external onlyOwner {
        payoutHandler = IPayout(payoutHandlerAddress);
    }

    function setReferralManager(address referralManagerAddress) external onlyOwner {
        referralManager = IReferralManager(referralManagerAddress);
        emit ReferralManagerUpdated(referralManagerAddress);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get product details
     */
    function getProduct(uint256 productId) external view returns (Product memory) {
        return products[productId];
    }

    /**
     * @notice Get purchase details
     */
    function getPurchase(uint256 purchaseId) external view returns (Purchase memory) {
        return purchases[purchaseId];
    }

    /**
     * @notice Get auction details
     */
    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    /**
     * @notice Get all bids for auction
     */
    function getAuctionBids(uint256 auctionId) external view returns (Bid[] memory) {
        return auctionBids[auctionId];
    }

    /**
     * @notice Get gifts for recipient
     */
    function getUserGifts(address user) external view returns (uint256[] memory) {
        return userGifts[user];
    }

    /**
     * @notice Get creator earnings
     */
    function getCreatorEarnings(address creator) external view returns (uint256) {
        return creatorEarnings[creator];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC721/ERC1155 OVERRIDES
    // ═══════════════════════════════════════════════════════════════════════════

    function supportsInterface(bytes4 interfaceId) public view override(ERC721) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        uint256 productId = tokenIdToProductId[tokenId];
        Product memory product = products[productId];
        return product.uri;
    }

    function uri(uint256 tokenId) public view returns (string memory) {
        return tokenURI(tokenId);
    }

    function approve(address, uint256) public pure override {
        revert("Soulbound: approvals disabled");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: approvals disabled");
    }

    function transferFrom(address, address, uint256) public pure override {
        revert("Soulbound: transfers disabled");
    }

    function safeTransferFrom(address, address, uint256) public pure override {
        revert("Soulbound: transfers disabled");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("Soulbound: transfers disabled");
    }



    receive() external payable {}
}
