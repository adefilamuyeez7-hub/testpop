// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title POAPCampaign
 * @notice Legacy POAP campaign contract with explicit tier accounting and safe auction cancellation.
 *         New product development should prefer POAPCampaignV2.
 */
contract POAPCampaign is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    enum CampaignType {
        Auction,
        Content,
        Subscriber
    }

    enum CampaignStatus {
        Active,
        Ended,
        Cancelled
    }

    enum TierBucket {
        Subscriber,
        Bidder,
        Creator
    }

    struct Tier {
        uint8 subscriberPct;
        uint8 bidderPct;
        uint8 creatorPct;
    }

    struct Campaign {
        address artist;
        string metadataURI;
        CampaignType campaignType;
        CampaignStatus status;
        uint256 maxSupply;
        uint256 minted;
        uint64 startTime;
        uint64 endTime;
        Tier tier;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        bool refunded;
        bool winner;
    }

    struct TierMinted {
        uint256 subscriberCount;
        uint256 bidderCount;
        uint256 creatorCount;
    }

    uint256 public nextCampaignId;
    uint256 public nextTokenId;
    uint256 public maxBidsPerCampaign = 500;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Bid[]) public campaignBids;
    mapping(uint256 => uint256) public tokenCampaign;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => mapping(address => bool)) public subscriberEligibility;
    mapping(uint256 => TierMinted) public tierMinted;
    mapping(address => uint256) public pendingWithdrawals;
    mapping(address => uint256) public artistBalance;

    event CampaignCreated(uint256 indexed id, address indexed artist, CampaignType campaignType);
    event BidPlaced(uint256 indexed campaignId, address indexed bidder, uint256 amount);
    event POAPClaimed(uint256 indexed campaignId, uint256 indexed tokenId, address indexed to);
    event AuctionSettled(uint256 indexed campaignId, uint256 winnerCount);
    event BidRefunded(uint256 indexed campaignId, address indexed bidder, uint256 amount);
    event BidRefundFailed(uint256 indexed campaignId, address indexed bidder, uint256 amount);
    event PendingWithdrawalClaimed(address indexed user, uint256 amount);
    event CampaignCancelled(uint256 indexed campaignId);
    event ArtistBidsClaimed(address indexed artist, uint256 amount);
    event SubscriberEligibilityUpdated(uint256 indexed campaignId, address indexed wallet, bool eligible);

    constructor() ERC721("POAPCampaign", "POAP") Ownable(msg.sender) {}

    function createCampaign(
        string calldata _uri,
        CampaignType _type,
        uint256 _maxSupply,
        uint64 _startTime,
        uint64 _endTime,
        uint8 _subPct,
        uint8 _bidPct,
        uint8 _creatorPct
    ) external returns (uint256 id) {
        require(bytes(_uri).length > 0, "Empty URI");
        require(_maxSupply > 0, "Zero supply");
        require(_endTime > _startTime, "Bad window");
        require(_subPct + _bidPct + _creatorPct == 100, "Tiers must total 100%");

        id = nextCampaignId++;
        campaigns[id] = Campaign({
            artist: msg.sender,
            metadataURI: _uri,
            campaignType: _type,
            status: CampaignStatus.Active,
            maxSupply: _maxSupply,
            minted: 0,
            startTime: _startTime == 0 ? uint64(block.timestamp) : _startTime,
            endTime: _endTime,
            tier: Tier(_subPct, _bidPct, _creatorPct)
        });

        emit CampaignCreated(id, msg.sender, _type);
    }

    function setMaxBidsPerCampaign(uint256 _newLimit) external onlyOwner {
        require(_newLimit >= 10, "Minimum 10 bids");
        require(_newLimit <= 10000, "Maximum 10000 bids");
        maxBidsPerCampaign = _newLimit;
    }

    function placeBid(uint256 _campaignId) external payable nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.campaignType == CampaignType.Auction, "Not auction");
        require(campaign.status == CampaignStatus.Active, "Not active");
        require(block.timestamp >= campaign.startTime && block.timestamp <= campaign.endTime, "Outside window");
        require(msg.value > 0, "Zero bid");
        require(campaignBids[_campaignId].length < maxBidsPerCampaign, "Bid limit reached");

        campaignBids[_campaignId].push(
            Bid({
                bidder: msg.sender,
                amount: msg.value,
                refunded: false,
                winner: false
            })
        );

        emit BidPlaced(_campaignId, msg.sender, msg.value);
    }

    function settleAuction(uint256 _campaignId) external nonReentrant {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.artist, "Not artist");
        require(campaign.campaignType == CampaignType.Auction, "Not auction");
        require(block.timestamp > campaign.endTime, "Not ended");
        require(campaign.status == CampaignStatus.Active, "Already settled");

        campaign.status = CampaignStatus.Ended;

        Bid[] storage bids = campaignBids[_campaignId];
        uint256 winnerSlots = _getTierCap(campaign, TierBucket.Bidder);
        if (winnerSlots > bids.length) {
            winnerSlots = bids.length;
        }

        for (uint256 i = 0; i < bids.length; i++) {
            for (uint256 j = i + 1; j < bids.length; j++) {
                if (bids[j].amount > bids[i].amount) {
                    Bid memory temp = bids[i];
                    bids[i] = bids[j];
                    bids[j] = temp;
                }
            }
        }

        uint256 artistRevenue = 0;
        for (uint256 i = 0; i < winnerSlots; i++) {
            bids[i].winner = true;
            artistRevenue += bids[i].amount;
            _mintPOAPForTier(_campaignId, bids[i].bidder, TierBucket.Bidder);
        }

        if (artistRevenue > 0) {
            artistBalance[campaign.artist] += artistRevenue;
        }

        for (uint256 i = winnerSlots; i < bids.length; i++) {
            if (bids[i].refunded) continue;

            _refundBid(_campaignId, bids[i].bidder, bids[i].amount);
            bids[i].refunded = true;
        }

        emit AuctionSettled(_campaignId, winnerSlots);
    }

    function distribute(uint256 _campaignId, address _to) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.artist, "Not artist");
        require(campaign.status == CampaignStatus.Active, "Not active");
        require(campaign.campaignType != CampaignType.Auction, "Auction uses settlement");
        require(!claimed[_campaignId][_to], "Already claimed");

        TierBucket bucket = campaign.campaignType == CampaignType.Content
            ? TierBucket.Creator
            : TierBucket.Subscriber;

        _mintPOAPForTier(_campaignId, _to, bucket);
    }

    function withdrawArtistBalance() external nonReentrant {
        uint256 balance = artistBalance[msg.sender];
        require(balance > 0, "No balance");

        artistBalance[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: balance}("");
        require(ok, "Transfer failed");

        emit ArtistBidsClaimed(msg.sender, balance);
    }

    function claimPendingWithdrawal() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No pending withdrawals");

        pendingWithdrawals[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Withdrawal failed");

        emit PendingWithdrawalClaimed(msg.sender, amount);
    }

    function getPendingWithdrawal(address _user) external view returns (uint256) {
        return pendingWithdrawals[_user];
    }

    function claim(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.campaignType == CampaignType.Subscriber, "Not subscriber campaign");
        require(campaign.status == CampaignStatus.Active, "Not active");
        require(block.timestamp >= campaign.startTime && block.timestamp <= campaign.endTime, "Outside window");
        require(!claimed[_campaignId][msg.sender], "Already claimed");
        require(subscriberEligibility[_campaignId][msg.sender], "Subscriber not approved");

        _mintPOAPForTier(_campaignId, msg.sender, TierBucket.Subscriber);
    }

    function setSubscriberEligibility(uint256 _campaignId, address _wallet, bool _eligible) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.campaignType == CampaignType.Subscriber, "Not subscriber campaign");
        require(msg.sender == campaign.artist || msg.sender == owner(), "Not authorized");
        require(_wallet != address(0), "Zero wallet");

        subscriberEligibility[_campaignId][_wallet] = _eligible;
        emit SubscriberEligibilityUpdated(_campaignId, _wallet, _eligible);
    }

    function cancelCampaign(uint256 _campaignId) external {
        Campaign storage campaign = campaigns[_campaignId];
        require(msg.sender == campaign.artist || msg.sender == owner(), "Not authorized");
        require(campaign.status == CampaignStatus.Active, "Not active");

        if (campaign.campaignType == CampaignType.Auction) {
            Bid[] storage bids = campaignBids[_campaignId];
            for (uint256 i = 0; i < bids.length; i++) {
                if (bids[i].refunded) continue;

                bids[i].refunded = true;
                _refundBid(_campaignId, bids[i].bidder, bids[i].amount);
            }
        }

        campaign.status = CampaignStatus.Cancelled;
        emit CampaignCancelled(_campaignId);
    }

    function _refundBid(uint256 _campaignId, address _bidder, uint256 _amount) internal {
        (bool ok, ) = _bidder.call{value: _amount}("");
        if (ok) {
            emit BidRefunded(_campaignId, _bidder, _amount);
        } else {
            pendingWithdrawals[_bidder] += _amount;
            emit BidRefundFailed(_campaignId, _bidder, _amount);
        }
    }

    function _mintPOAPForTier(uint256 _campaignId, address _to, TierBucket _bucket) internal {
        Campaign storage campaign = campaigns[_campaignId];
        require(campaign.minted < campaign.maxSupply, "Supply exhausted");
        require(_getTierMinted(_campaignId, _bucket) < _getTierCap(campaign, _bucket), "Tier exhausted");

        uint256 tokenId = nextTokenId++;
        campaign.minted += 1;
        claimed[_campaignId][_to] = true;
        tokenCampaign[tokenId] = _campaignId;
        _incrementTierMinted(_campaignId, _bucket);

        _safeMint(_to, tokenId);
        _setTokenURI(tokenId, campaign.metadataURI);

        emit POAPClaimed(_campaignId, tokenId, _to);
    }

    function _getTierCap(Campaign storage campaign, TierBucket _bucket) internal view returns (uint256) {
        if (_bucket == TierBucket.Subscriber) {
            return (campaign.maxSupply * campaign.tier.subscriberPct) / 100;
        }
        if (_bucket == TierBucket.Bidder) {
            return (campaign.maxSupply * campaign.tier.bidderPct) / 100;
        }
        return (campaign.maxSupply * campaign.tier.creatorPct) / 100;
    }

    function _getTierMinted(uint256 _campaignId, TierBucket _bucket) internal view returns (uint256) {
        TierMinted storage minted = tierMinted[_campaignId];
        if (_bucket == TierBucket.Subscriber) {
            return minted.subscriberCount;
        }
        if (_bucket == TierBucket.Bidder) {
            return minted.bidderCount;
        }
        return minted.creatorCount;
    }

    function _incrementTierMinted(uint256 _campaignId, TierBucket _bucket) internal {
        TierMinted storage minted = tierMinted[_campaignId];
        if (_bucket == TierBucket.Subscriber) {
            minted.subscriberCount += 1;
        } else if (_bucket == TierBucket.Bidder) {
            minted.bidderCount += 1;
        } else {
            minted.creatorCount += 1;
        }
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
