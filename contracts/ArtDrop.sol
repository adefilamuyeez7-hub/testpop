// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArtDrop
 * @notice ERC-721 contract for minting art drops on Base.
 *         Artists create drops with a price, supply cap, and duration.
 *         Collectors mint during the active window.
 */
contract ArtDrop is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────
    struct Drop {
        address artist;
        string  metadataURI;     // IPFS CID for the artwork metadata
        uint256 priceWei;        // mint price in wei
        uint256 maxSupply;       // 0 = unlimited
        uint256 minted;
        uint64  startTime;
        uint64  endTime;         // 0 = no deadline
        bool    paused;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    uint256 public nextDropId;
    uint256 public nextTokenId;

    mapping(uint256 => Drop)    public drops;
    mapping(uint256 => uint256) public tokenDrop; // tokenId → dropId

    mapping(address => uint256) public subscribers;
    mapping(address => mapping(address => bool)) public hasSubscribed;  // artist => subscriber => bool
    mapping(address => mapping(address => uint256)) public subscriptionBalance;  // artist => subscriber => amount
    mapping(address => mapping(address => uint256)) public subscriptionExpiry;  // artist => subscriber => expiry timestamp
    mapping(address => uint256) public minSubscriptionFee;  // artist => minimum fee required
    uint256 public totalSubscriptionRevenue;
    
    // Withdrawal mapping for failed transfers
    mapping(address => uint256) public pendingWithdrawals;

    uint256 public platformFeeBps = 250; // 2.5 %
    uint256 public constant SUBSCRIPTION_DURATION = 30 days;
    address public feeRecipient;
    mapping(address => bool) public approvedArtists;  // Artist whitelist

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event DropCreated(uint256 indexed dropId, address indexed artist, uint256 price, uint256 maxSupply);
    event ArtMinted(uint256 indexed dropId, uint256 indexed tokenId, address indexed collector);
    event DropPaused(uint256 indexed dropId, bool paused);
    event Withdrawn(address indexed artist, uint256 amount);
    event ArtistSubscribed(address indexed artist, address indexed subscriber, uint256 amount, uint256 artistShare, uint256 adminShare, uint256 expiryTime);
    event SubscriptionRenewed(address indexed artist, address indexed subscriber, uint256 amount, uint256 newExpiryTime);
    
    // ✅ NEW: Fund distribution tracking events
    event SubscriptionFundsDistributed(address indexed recipient, uint256 amount, string recipientType);  // Artist or Admin
    event SubscriptionFundsPending(address indexed recipient, uint256 amount, string reason);
    event SubscriptionCancelled(address indexed artist, address indexed subscriber, uint256 refundAmount);
    event AdminFeesWithdrawn(address indexed admin, uint256 amount);
    event MinSubscriptionFeeSet(address indexed artist, uint256 newFee);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor(address _feeRecipient)
        ERC721("ArtDrop", "ADROP")
        Ownable(msg.sender)
    {
        feeRecipient = _feeRecipient;
    }

    // ──────────────────────────────────────────────
    //  Artist actions
    // ──────────────────────────────────────────────
    function createDrop(
        string calldata _metadataURI,
        uint256 _priceWei,
        uint256 _maxSupply,
        uint64  _startTime,
        uint64  _endTime
    ) external returns (uint256 dropId) {
        require(approvedArtists[msg.sender], "Artist not approved");
        require(bytes(_metadataURI).length > 0, "Empty URI");
        require(_endTime == 0 || _endTime > _startTime, "Bad window");

        dropId = nextDropId++;
        drops[dropId] = Drop({
            artist:      msg.sender,
            metadataURI: _metadataURI,
            priceWei:    _priceWei,
            maxSupply:   _maxSupply,
            minted:      0,
            startTime:   _startTime == 0 ? uint64(block.timestamp) : _startTime,
            endTime:     _endTime,
            paused:      false
        });

        emit DropCreated(dropId, msg.sender, _priceWei, _maxSupply);
    }

    function togglePause(uint256 _dropId) external {
        Drop storage d = drops[_dropId];
        require(msg.sender == d.artist, "Not artist");
        d.paused = !d.paused;
        emit DropPaused(_dropId, d.paused);
    }

    function subscribe(address artist) external payable nonReentrant {
        require(artist != address(0), "Invalid artist address");
        require(msg.value > 0, "Must send ETH to subscribe");
        require(feeRecipient != address(0), "Fee recipient not set");
        require(msg.value >= minSubscriptionFee[artist], "Below minimum subscription fee");

        // Allow re-subscription if expired or not yet subscribed
        require(!hasSubscribed[artist][msg.sender] || block.timestamp > subscriptionExpiry[artist][msg.sender], "Subscription still active");

        // Split funds: 70% artist, 30% admin (founder)
        uint256 artistShare = (msg.value * 70) / 100;
        uint256 adminShare = msg.value - artistShare;

        // Mark as subscribed and track amount + expiry
        bool isNewSubscriber = !hasSubscribed[artist][msg.sender] || block.timestamp > subscriptionExpiry[artist][msg.sender];
        if (isNewSubscriber) {
            subscribers[artist] += 1;  // Count unique subscribers only on first subscription
        }
        hasSubscribed[artist][msg.sender] = true;
        subscriptionBalance[artist][msg.sender] = msg.value;
        subscriptionExpiry[artist][msg.sender] = block.timestamp + SUBSCRIPTION_DURATION;
        totalSubscriptionRevenue += msg.value;

        // Try to send to artist immediately, otherwise add to pending withdrawals
        (bool sentArtist, ) = artist.call{value: artistShare}("");
        if (!sentArtist) {
            pendingWithdrawals[artist] += artistShare;
            emit SubscriptionFundsPending(artist, artistShare, "Artist transfer failed");
        } else {
            emit SubscriptionFundsDistributed(artist, artistShare, "Artist");
        }

        // Try to send to admin (founder) immediately, otherwise add to pending withdrawals
        (bool sentAdmin, ) = feeRecipient.call{value: adminShare}("");
        if (!sentAdmin) {
            pendingWithdrawals[feeRecipient] += adminShare;
            emit SubscriptionFundsPending(feeRecipient, adminShare, "Admin transfer failed");
        } else {
            emit SubscriptionFundsDistributed(feeRecipient, adminShare, "Admin/Founder");
        }

        emit ArtistSubscribed(artist, msg.sender, msg.value, artistShare, adminShare, subscriptionExpiry[artist][msg.sender]);
    }

    // ✅ NEW: Allow artists to cancel a subscriber (enables renewal after cancellation)
    function cancelSubscription(address subscriber) external nonReentrant {
        require(subscriber != address(0), "Invalid subscriber");
        require(hasSubscribed[msg.sender][subscriber], "Not subscribed");
        
        hasSubscribed[msg.sender][subscriber] = false;
        uint256 amount = subscriptionBalance[msg.sender][subscriber];
        subscriptionBalance[msg.sender][subscriber] = 0;
        subscribers[msg.sender] -= 1;
        
        emit SubscriptionCancelled(msg.sender, subscriber, amount);
    }

    // ✅ NEW: Allow admin/founder to withdraw accumulated subscription fees
    function withdrawSubscriptionFees() external nonReentrant {
        require(msg.sender == feeRecipient, "Only admin can call this");
        
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending fees");
        
        pendingWithdrawals[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit AdminFeesWithdrawn(msg.sender, amount);
    }

    // ──────────────────────────────────────────────
    //  Collector actions
    // ──────────────────────────────────────────────
    function mint(uint256 _dropId) external payable nonReentrant returns (uint256 tokenId) {
        Drop storage d = drops[_dropId];
        require(!d.paused, "Paused");
        require(block.timestamp >= d.startTime, "Not started");
        require(d.endTime == 0 || block.timestamp <= d.endTime, "Ended");
        require(d.maxSupply == 0 || d.minted < d.maxSupply, "Sold out");
        require(msg.value >= d.priceWei, "Insufficient ETH");

        tokenId = nextTokenId++;
        d.minted++;
        tokenDrop[tokenId] = _dropId;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, d.metadataURI);

        emit ArtMinted(_dropId, tokenId, msg.sender);

        // Split payment: platform fee → feeRecipient, remainder → artist
        uint256 fee = (msg.value * platformFeeBps) / 10_000;
        if (fee > 0) {
            (bool s1, ) = feeRecipient.call{value: fee}("");
            if (!s1) {
                pendingWithdrawals[feeRecipient] += fee;
            }
        }
        uint256 artistPay = msg.value - fee;
        if (artistPay > 0) {
            (bool s2, ) = d.artist.call{value: artistPay}("");
            if (!s2) {
                pendingWithdrawals[d.artist] += artistPay;
            }
        }
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────
    function setFee(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Max 10%");
        platformFeeBps = _bps;
    }

    function setFeeRecipient(address _addr) external onlyOwner {
        feeRecipient = _addr;
    }

    function approveArtist(address _artist) external onlyOwner {
        approvedArtists[_artist] = true;
    }

    function disapproveArtist(address _artist) external onlyOwner {
        approvedArtists[_artist] = false;
    }

    function setMinSubscriptionFee(address artist, uint256 _fee) external {
        require(msg.sender == artist || msg.sender == owner(), "Only artist or owner");
        minSubscriptionFee[artist] = _fee;
        emit MinSubscriptionFeeSet(artist, _fee);
    }

    // ──────────────────────────────────────────────
    //  Withdrawals (for failed transfers)
    // ──────────────────────────────────────────────
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawals");
        
        pendingWithdrawals[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    // ──────────────────────────────────────────────
    //  Subscription view functions
    // ──────────────────────────────────────────────
    function isSubscribed(address artist, address subscriber) external view returns (bool) {
        return hasSubscribed[artist][subscriber];
    }

    function getSubscriptionAmount(address artist, address subscriber) external view returns (uint256) {
        return subscriptionBalance[artist][subscriber];
    }

    function getUniqueSubscriberCount(address artist) external view returns (uint256) {
        return subscribers[artist];
    }

    function isSubscriptionActive(address artist, address subscriber) external view returns (bool) {
        return hasSubscribed[artist][subscriber] && block.timestamp <= subscriptionExpiry[artist][subscriber];
    }

    function getSubscriptionTimeRemaining(address artist, address subscriber) external view returns (uint256) {
        if (!hasSubscribed[artist][subscriber] || block.timestamp > subscriptionExpiry[artist][subscriber]) {
            return 0;
        }
        return subscriptionExpiry[artist][subscriber] - block.timestamp;
    }

    // ──────────────────────────────────────────────
    //  Overrides
    // ──────────────────────────────────────────────
    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
