// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title POAPCampaign
 * @notice ERC-721 POAP system for artist campaigns on Base.
 *         Supports three campaign types:
 *           - Auction:    Raffle-style bidding; losers refunded, winner gets POAP
 *           - Content:    Artist distributes POAPs to content creators
 *           - Subscriber: POAPs for subscribers (free claim)
 *
 *         Tiered distribution: subscribers, bidders, creators each get
 *         a percentage of the total POAP supply.
 */
contract POAPCampaign is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────
    enum CampaignType { Auction, Content, Subscriber }
    enum CampaignStatus { Active, Ended, Cancelled }

    struct Tier {
        uint8  subscriberPct;  // % of supply for subscribers
        uint8  bidderPct;      // % of supply for auction winners
        uint8  creatorPct;     // % of supply for content creators
    }

    struct Campaign {
        address        artist;
        string         metadataURI;
        CampaignType   campaignType;
        CampaignStatus status;
        uint256        maxSupply;
        uint256        minted;
        uint64         startTime;
        uint64         endTime;
        Tier           tier;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        bool    refunded;
        bool    winner;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    uint256 public nextCampaignId;
    uint256 public nextTokenId;

    mapping(uint256 => Campaign)     public campaigns;
    mapping(uint256 => Bid[])        public campaignBids;     // campaignId → bids
    mapping(uint256 => uint256)      public tokenCampaign;    // tokenId → campaignId
    mapping(uint256 => mapping(address => bool)) public claimed; // campaignId → addr → claimed
    mapping(address => uint256)      public artistBalance;    // artist → pending ETH from auctions

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event CampaignCreated(uint256 indexed id, address indexed artist, CampaignType cType);
    event BidPlaced(uint256 indexed campaignId, address indexed bidder, uint256 amount);
    event POAPClaimed(uint256 indexed campaignId, uint256 indexed tokenId, address indexed to);
    event AuctionSettled(uint256 indexed campaignId, uint256 winnerCount);
    event BidRefunded(uint256 indexed campaignId, address indexed bidder, uint256 amount);
    event BidRefundFailed(uint256 indexed campaignId, address indexed bidder, uint256 amount);
    event PendingWithdrawalClaimed(address indexed user, uint256 amount);
    event CampaignCancelled(uint256 indexed campaignId);
    event ArtistBidsClaimed(address indexed artist, uint256 amount);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor() ERC721("POAPCampaign", "POAP") Ownable(msg.sender) {}

    // ──────────────────────────────────────────────
    //  Artist: Create campaign
    // ──────────────────────────────────────────────
    function createCampaign(
        string calldata _uri,
        CampaignType    _type,
        uint256         _maxSupply,
        uint64          _startTime,
        uint64          _endTime,
        uint8           _subPct,
        uint8           _bidPct,
        uint8           _creatorPct
    ) external returns (uint256 id) {
        require(bytes(_uri).length > 0, "Empty URI");
        require(_subPct + _bidPct + _creatorPct == 100, "Tiers must total 100%");
        require(_endTime > _startTime, "Bad window");
        require(_maxSupply > 0, "Zero supply");

        id = nextCampaignId++;
        campaigns[id] = Campaign({
            artist:       msg.sender,
            metadataURI:  _uri,
            campaignType: _type,
            status:       CampaignStatus.Active,
            maxSupply:    _maxSupply,
            minted:       0,
            startTime:    _startTime == 0 ? uint64(block.timestamp) : _startTime,
            endTime:      _endTime,
            tier:         Tier(_subPct, _bidPct, _creatorPct)
        });

        emit CampaignCreated(id, msg.sender, _type);
    }

    // ──────────────────────────────────────────────
    //  Bidding (Auction campaigns)
    // ──────────────────────────────────────────────
    
    // ✅ NEW: Pending withdrawals for failed refunds
    mapping(address => uint256) public pendingWithdrawals;
    
    // ✅ NEW: Bid limit to prevent DoS (O(n²) sorting attack)
    uint256 public maxBidsPerCampaign = 500;
    
    function setMaxBidsPerCampaign(uint256 _newLimit) external onlyOwner {
        require(_newLimit >= 10, "Minimum 10 bids");
        require(_newLimit <= 10000, "Maximum 10000 bids");
        maxBidsPerCampaign = _newLimit;
    }
    
    function placeBid(uint256 _campaignId) external payable nonReentrant {
        Campaign storage c = campaigns[_campaignId];
        require(c.campaignType == CampaignType.Auction, "Not auction");
        require(c.status == CampaignStatus.Active, "Not active");
        require(block.timestamp >= c.startTime && block.timestamp <= c.endTime, "Outside window");
        require(msg.value > 0, "Zero bid");
        
        // ✅ NEW: Prevent DoS via massive bid arrays
        require(campaignBids[_campaignId].length < maxBidsPerCampaign, "Bid limit reached");

        campaignBids[_campaignId].push(Bid({
            bidder:   msg.sender,
            amount:   msg.value,
            refunded: false,
            winner:   false
        }));

        emit BidPlaced(_campaignId, msg.sender, msg.value);
    }

    /**
     * @notice Artist settles the auction: top N bidders win POAPs, rest are refunded.
     *         N = maxSupply * bidderPct / 100
     */
    function settleAuction(uint256 _campaignId) external nonReentrant {
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.artist, "Not artist");
        require(c.campaignType == CampaignType.Auction, "Not auction");
        require(block.timestamp > c.endTime, "Not ended");
        require(c.status == CampaignStatus.Active, "Already settled");

        c.status = CampaignStatus.Ended;

        Bid[] storage bids = campaignBids[_campaignId];
        uint256 winnerSlots = (c.maxSupply * c.tier.bidderPct) / 100;
        if (winnerSlots > bids.length) winnerSlots = bids.length;

        // Simple sort descending by amount (fine for small arrays)
        for (uint256 i = 0; i < bids.length; i++) {
            for (uint256 j = i + 1; j < bids.length; j++) {
                if (bids[j].amount > bids[i].amount) {
                    Bid memory tmp = bids[i];
                    bids[i] = bids[j];
                    bids[j] = tmp;
                }
            }
        }

        // Accumulate winner bids for artist
        uint256 artistRevenue = 0;
        for (uint256 i = 0; i < winnerSlots; i++) {
            bids[i].winner = true;
            artistRevenue += bids[i].amount;
            _mintPOAP(_campaignId, bids[i].bidder);
        }
        
        // Store artist balance instead of leaving ETH in contract
        if (artistRevenue > 0) {
            artistBalance[c.artist] += artistRevenue;
        }

        // ✅ FIXED: Refund losers with fallback mechanism
        for (uint256 i = winnerSlots; i < bids.length; i++) {
            if (!bids[i].refunded) {
                (bool ok, ) = bids[i].bidder.call{value: bids[i].amount}("");
                
                if (ok) {
                    bids[i].refunded = true;
                    emit BidRefunded(_campaignId, bids[i].bidder, bids[i].amount);
                } else {
                    // ✅ NEW: Add to pending withdrawals instead of losing it
                    pendingWithdrawals[bids[i].bidder] += bids[i].amount;
                    bids[i].refunded = true;  // Mark so we don't retry
                    emit BidRefundFailed(_campaignId, bids[i].bidder, bids[i].amount);
                }
            }
        }

        emit AuctionSettled(_campaignId, winnerSlots);
    }

    // ──────────────────────────────────────────────
    //  Free claim (Subscriber / Content campaigns)
    // ──────────────────────────────────────────────

    /**
     * @notice Artist distributes a POAP to a specific address (content creators, subscribers).
     */
    function distribute(uint256 _campaignId, address _to) external {
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.artist, "Not artist");
        require(c.status == CampaignStatus.Active, "Not active");
        require(!claimed[_campaignId][_to], "Already claimed");

        _mintPOAP(_campaignId, _to);
    }

    /**
     * @notice Subscribers self-claim during the active window.
     */
    /**
     * @notice Artist withdraws accumulated auction bids.
     */
    function withdrawArtistBalance() external nonReentrant {
        uint256 balance = artistBalance[msg.sender];
        require(balance > 0, "No balance");
        
        artistBalance[msg.sender] = 0;
        
        (bool ok, ) = msg.sender.call{value: balance}("");
        require(ok, "Transfer failed");
        
        emit ArtistBidsClaimed(msg.sender, balance);
    }
    
    // ✅ NEW: Allow users to claim pending withdrawals from failed refunds
    function claimPendingWithdrawal() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawals");
        
        pendingWithdrawals[msg.sender] = 0;
        
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Withdrawal failed");
        
        emit PendingWithdrawalClaimed(msg.sender, amount);
    }
    
    // ✅ NEW: View pending withdrawals
    function getPendingWithdrawal(address _user) external view returns (uint256) {
        return pendingWithdrawals[_user];
    }

    function claim(uint256 _campaignId) external {
        Campaign storage c = campaigns[_campaignId];
        require(c.campaignType == CampaignType.Subscriber, "Not subscriber campaign");
        require(c.status == CampaignStatus.Active, "Not active");
        require(block.timestamp >= c.startTime && block.timestamp <= c.endTime, "Outside window");
        require(!claimed[_campaignId][msg.sender], "Already claimed");

        _mintPOAP(_campaignId, msg.sender);
    }

    // ──────────────────────────────────────────────
    //  Cancel
    // ──────────────────────────────────────────────
    function cancelCampaign(uint256 _campaignId) external {
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.artist || msg.sender == owner(), "Not authorized");
        c.status = CampaignStatus.Cancelled;
        emit CampaignCancelled(_campaignId);
    }

    // ──────────────────────────────────────────────
    //  Internal
    // ──────────────────────────────────────────────
    function _mintPOAP(uint256 _campaignId, address _to) internal {
        Campaign storage c = campaigns[_campaignId];
        require(c.minted < c.maxSupply, "Supply exhausted");

        uint256 tokenId = nextTokenId++;
        c.minted++;
        claimed[_campaignId][_to] = true;
        tokenCampaign[tokenId] = _campaignId;

        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, c.metadataURI);

        emit POAPClaimed(_campaignId, tokenId, _to);
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
