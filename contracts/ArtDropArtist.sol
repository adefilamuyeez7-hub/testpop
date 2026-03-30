// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArtDrop
 * @notice Individual ERC-721 contract deployed for each artist via ArtDropFactory.
 *         Each artist has their own contract instance with artist and founder wallet configured.
 *         Artists create drops, and collectors mint. Subscriptions split funds 70% artist / 30% founder.
 */
contract ArtDrop is ERC721, ERC721URIStorage, ReentrancyGuard {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────
    struct Drop {
        string  metadataURI;     // IPFS CID for the artwork metadata
        uint256 priceWei;        // mint price in wei
        uint256 maxSupply;       // 0 = unlimited
        uint256 minted;
        uint64  startTime;
        uint64  endTime;         // 0 = no deadline
        bool    paused;
    }

    // ──────────────────────────────────────────────
    //  State - Artist & Founder Specific
    // ──────────────────────────────────────────────
    address public immutable artist;         // The artist who owns this contract
    address public immutable founderWallet;  // The founder/admin wallet (30% recipient)

    // ──────────────────────────────────────────────
    //  State - Drops & NFTs
    // ──────────────────────────────────────────────
    uint256 public nextDropId;
    uint256 public nextTokenId;

    mapping(uint256 => Drop)    public drops;
    mapping(uint256 => uint256) public tokenDrop; // tokenId → dropId

    // ──────────────────────────────────────────────
    //  State - Subscriptions (scoped to this artist)
    // ──────────────────────────────────────────────
    mapping(address => bool) public hasSubscribed;        // subscriber → bool (one per wallet)
    mapping(address => uint256) public subscriptionAmount; // subscriber → subscription amount
    mapping(address => uint256) public subscriptionExpiry; // subscriber → expiry timestamp
    uint256 public minSubscriptionFee = 0.001 ether;      // Minimum fee required
    uint256 public subscriberCount;                        // unique count
    uint256 public totalSubscriptionRevenue;
    uint256 public constant SUBSCRIPTION_DURATION = 30 days;

    // Withdrawal mapping for failed transfers
    mapping(address => uint256) public pendingWithdrawals;

    uint256 public platformFeeBps = 250; // 2.5 % on mints

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event DropCreated(uint256 indexed dropId, uint256 price, uint256 maxSupply);
    event ArtMinted(uint256 indexed dropId, uint256 indexed tokenId, address indexed collector);
    event DropPaused(uint256 indexed dropId, bool paused);
    event Withdrawn(address indexed recipient, uint256 amount);
    
    // Subscription events
    event NewSubscription(address indexed subscriber, uint256 amount, uint256 artistShare, uint256 founderShare, uint256 expiryTime);
    event SubscriptionRenewed(address indexed subscriber, uint256 amount, uint256 newExpiryTime);
    event SubscriptionFundsDistributed(address indexed recipient, uint256 amount, string recipientType);
    event SubscriptionFundsPending(address indexed recipient, uint256 amount, string reason);
    event SubscriptionCancelled(address indexed subscriber);
    event FounderFeesWithdrawn(address indexed founder, uint256 amount);
    event MinSubscriptionFeeSet(uint256 newFee);

    // ──────────────────────────────────────────────
    //  Constructor - Called by Factory
    // ──────────────────────────────────────────────
    constructor(address _artist, address _founder)
        ERC721("ArtDrop", "ADROP")
    {
        require(_artist != address(0), "Invalid artist");
        require(_founder != address(0), "Invalid founder");
        require(_artist != _founder, "Artist and founder must differ");
        
        artist = _artist;
        founderWallet = _founder;
    }

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────
    modifier onlyArtist() {
        require(msg.sender == artist, "Only artist");
        _;
    }

    // ──────────────────────────────────────────────
    //  Artist - Drop Management
    // ──────────────────────────────────────────────
    /**
     * @notice Artist creates a new drop/collection
     * @param _metadataURI IPFS URI for artwork metadata
     * @param _priceWei mint price in wei
     * @param _maxSupply Maximum supply (0 = unlimited)
     * @param _startTime When minting begins (0 = now)
     * @param _endTime When minting ends (0 = no deadline)
     */
    function createDrop(
        string calldata _metadataURI,
        uint256 _priceWei,
        uint256 _maxSupply,
        uint64  _startTime,
        uint64  _endTime
    ) external onlyArtist returns (uint256 dropId) {
        require(bytes(_metadataURI).length > 0, "Empty URI");
        require(_endTime == 0 || _endTime > _startTime, "Invalid time window");

        dropId = nextDropId++;
        drops[dropId] = Drop({
            metadataURI: _metadataURI,
            priceWei:    _priceWei,
            maxSupply:   _maxSupply,
            minted:      0,
            startTime:   _startTime == 0 ? uint64(block.timestamp) : _startTime,
            endTime:     _endTime,
            paused:      false
        });

        emit DropCreated(dropId, _priceWei, _maxSupply);
        return dropId;
    }

    /**
     * @notice Artist pauses/unpauses their drop
     */
    function togglePause(uint256 _dropId) external onlyArtist {
        Drop storage d = drops[_dropId];
        d.paused = !d.paused;
        emit DropPaused(_dropId, d.paused);
    }

    // ──────────────────────────────────────────────
    //  Collector - Subscribe to Artist
    // ──────────────────────────────────────────────
    /**
     * @notice Subscribe to this artist's work
     *         Splits: 70% to artist, 30% to founder
     *         Each wallet can only subscribe once (call cancelSubscription to renew)
     */
    function subscribe() external payable nonReentrant {
        require(msg.value >= minSubscriptionFee, "Below minimum subscription fee");
        require(!hasSubscribed[msg.sender] || block.timestamp > subscriptionExpiry[msg.sender], "Subscription still active");

        // Mark as subscribed and track amount + expiry
        // Only increment subscriber count on FIRST subscription, not on renewals
        bool isNewSubscriber = !hasSubscribed[msg.sender];
        if (isNewSubscriber) {
            subscriberCount += 1;
        }
        hasSubscribed[msg.sender] = true;
        subscriptionAmount[msg.sender] = msg.value;
        subscriptionExpiry[msg.sender] = block.timestamp + SUBSCRIPTION_DURATION;
        totalSubscriptionRevenue += msg.value;

        // Split: 70% artist, 30% founder
        uint256 artistShare = (msg.value * 70) / 100;
        uint256 founderShare = msg.value - artistShare;

        // Send to artist
        (bool sentArtist, ) = artist.call{value: artistShare}("");
        if (!sentArtist) {
            pendingWithdrawals[artist] += artistShare;
            emit SubscriptionFundsPending(artist, artistShare, "Artist transfer failed");
        } else {
            emit SubscriptionFundsDistributed(artist, artistShare, "Artist");
        }

        // Send to founder
        (bool sentFounder, ) = founderWallet.call{value: founderShare}("");
        if (!sentFounder) {
            pendingWithdrawals[founderWallet] += founderShare;
            emit SubscriptionFundsPending(founderWallet, founderShare, "Founder transfer failed");
        } else {
            emit SubscriptionFundsDistributed(founderWallet, founderShare, "Founder");
        }

        emit NewSubscription(msg.sender, msg.value, artistShare, founderShare, subscriptionExpiry[msg.sender]);
    }

    /**
     * @notice Allow artist to cancel a subscriber's subscription for renewal
     */
    function cancelSubscription(address _subscriber) external onlyArtist {
        require(_subscriber != address(0), "Invalid subscriber");
        require(hasSubscribed[_subscriber], "Not subscribed");

        hasSubscribed[_subscriber] = false;
        subscriptionAmount[_subscriber] = 0;
        subscriberCount -= 1;

        emit SubscriptionCancelled(_subscriber);
    }

    /**
     * @notice Founder withdraws accumulated fees from failed transfers
     */
    function withdrawFounderFees() external nonReentrant {
        require(msg.sender == founderWallet, "Only founder can withdraw");

        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending fees");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit FounderFeesWithdrawn(msg.sender, amount);
    }

    // ──────────────────────────────────────────────
    //  Collector - Mint NFTs
    // ──────────────────────────────────────────────
    /**
     * @notice Collector mints an NFT from a drop
     * @param _dropId ID of the drop to mint from
     */
    function mint(uint256 _dropId) external payable nonReentrant returns (uint256 tokenId) {
        Drop storage d = drops[_dropId];
        require(!d.paused, "Drop paused");
        require(block.timestamp >= d.startTime, "Drop not started");
        require(d.endTime == 0 || block.timestamp <= d.endTime, "Drop ended");
        require(d.maxSupply == 0 || d.minted < d.maxSupply, "Sold out");
        require(msg.value >= d.priceWei, "Insufficient ETH");

        // Refund overpayment
        uint256 overpayment = msg.value - d.priceWei;
        if (overpayment > 0) {
            (bool refunded, ) = msg.sender.call{value: overpayment}("");
            if (!refunded) {
                pendingWithdrawals[msg.sender] += overpayment;
            }
        }

        tokenId = nextTokenId++;
        d.minted++;
        tokenDrop[tokenId] = _dropId;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, d.metadataURI);

        emit ArtMinted(_dropId, tokenId, msg.sender);

        // Split payment: platform fee → founder, remainder → artist
        uint256 fee = (d.priceWei * platformFeeBps) / 10_000;
        if (fee > 0) {
            (bool s1, ) = founderWallet.call{value: fee}("");
            if (!s1) {
                pendingWithdrawals[founderWallet] += fee;
            }
        }
        uint256 artistPay = d.priceWei - fee;
        if (artistPay > 0) {
            (bool s2, ) = artist.call{value: artistPay}("");
            if (!s2) {
                pendingWithdrawals[artist] += artistPay;
            }
        }

        return tokenId;
    }

    // ──────────────────────────────────────────────
    //  Admin - Configuration
    // ──────────────────────────────────────────────
    function setMintFee(uint256 _bps) external {
        require(msg.sender == artist, "Only artist can set fees");
        require(_bps <= 1000, "Max 10%");
        platformFeeBps = _bps;
    }
    
    function setMinSubscriptionFee(uint256 _fee) external {
        require(msg.sender == artist, "Only artist");
        minSubscriptionFee = _fee;
        emit MinSubscriptionFeeSet(_fee);
    }

    // ──────────────────────────────────────────────
    //  Withdrawal (for failed transfers)
    // ──────────────────────────────────────────────
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawals");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    // ──────────────────────────────────────────────
    //  View - Subscriptions
    // ──────────────────────────────────────────────
    function isSubscribed(address _subscriber) external view returns (bool) {
        return hasSubscribed[_subscriber];
    }

    function getSubscriptionAmount(address _subscriber) external view returns (uint256) {
        return subscriptionAmount[_subscriber];
    }

    function getSubscriberCount() external view returns (uint256) {
        return subscriberCount;
    }

    function isSubscriptionActive(address _subscriber) external view returns (bool) {
        return hasSubscribed[_subscriber] && block.timestamp <= subscriptionExpiry[_subscriber];
    }

    function getSubscriptionTimeRemaining(address _subscriber) external view returns (uint256) {
        if (!hasSubscribed[_subscriber] || block.timestamp > subscriptionExpiry[_subscriber]) {
            return 0;
        }
        return subscriptionExpiry[_subscriber] - block.timestamp;
    }

    // ──────────────────────────────────────────────
    //  View - Drops
    // ──────────────────────────────────────────────
    function getDrop(uint256 _dropId) external view returns (Drop memory) {
        return drops[_dropId];
    }

    function getDropMinted(uint256 _dropId) external view returns (uint256) {
        return drops[_dropId].minted;
    }

    // ──────────────────────────────────────────────
    //  ERC721 Overrides
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
