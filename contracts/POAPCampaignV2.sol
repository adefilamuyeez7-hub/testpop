// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title POAPCampaignV2
 * @notice Campaign contract for counted ETH/content participation credits with delayed POAP redemption.
 *         One ETH entry credit or one approved content credit allows one POAP redemption after the
 *         redeem window opens. Intended for campaign participation, not winner selection.
 */
contract POAPCampaignV2 is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    enum EntryMode {
        Eth,
        Content,
        Both
    }

    enum CampaignStatus {
        Active,
        Cancelled
    }

    struct Campaign {
        address artist;
        string metadataURI;
        EntryMode entryMode;
        CampaignStatus status;
        uint256 maxSupply;
        uint256 minted;
        uint256 ticketPriceWei;
        uint64 startTime;
        uint64 endTime;
        uint64 redeemStartTime;
    }

    uint256 public nextCampaignId;
    uint256 public nextTokenId;

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public ethCredits;
    mapping(uint256 => mapping(address => uint256)) public contentCredits;
    mapping(uint256 => mapping(address => uint256)) public redeemedCredits;
    mapping(uint256 => uint256) public tokenCampaign;
    mapping(address => uint256) public artistBalance;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed artist,
        EntryMode entryMode,
        uint256 maxSupply,
        uint256 ticketPriceWei,
        uint64 startTime,
        uint64 endTime,
        uint64 redeemStartTime
    );
    event EthEntriesPurchased(uint256 indexed campaignId, address indexed buyer, uint256 quantity, uint256 amountWei);
    event ContentCreditsGranted(uint256 indexed campaignId, address indexed wallet, uint256 quantity);
    event ContentCreditsRevoked(uint256 indexed campaignId, address indexed wallet, uint256 quantity);
    event RewardsRedeemed(uint256 indexed campaignId, address indexed wallet, uint256 quantity);
    event ArtistBalanceWithdrawn(address indexed artist, uint256 amount);
    event CampaignCancelled(uint256 indexed campaignId);

    constructor() ERC721("POAP Campaign V2", "POAP2") Ownable(msg.sender) {}

    function createCampaign(
        string calldata metadataURI,
        EntryMode entryMode,
        uint256 maxSupply,
        uint256 ticketPriceWei,
        uint64 startTime,
        uint64 endTime,
        uint64 redeemStartTime
    ) external returns (uint256 campaignId) {
        require(bytes(metadataURI).length > 0, "Empty URI");
        require(maxSupply > 0, "Zero supply");
        require(endTime > startTime, "Bad window");
        require(redeemStartTime >= endTime + 1 days, "Redeem too early");

        if (entryMode == EntryMode.Content) {
            require(ticketPriceWei == 0, "Content only price must be zero");
        } else {
            require(ticketPriceWei > 0, "ETH entry price required");
        }

        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            artist: msg.sender,
            metadataURI: metadataURI,
            entryMode: entryMode,
            status: CampaignStatus.Active,
            maxSupply: maxSupply,
            minted: 0,
            ticketPriceWei: ticketPriceWei,
            startTime: startTime,
            endTime: endTime,
            redeemStartTime: redeemStartTime
        });

        emit CampaignCreated(
            campaignId,
            msg.sender,
            entryMode,
            maxSupply,
            ticketPriceWei,
            startTime,
            endTime,
            redeemStartTime
        );
    }

    function buyEntries(uint256 campaignId, uint256 quantity) external payable nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.artist != address(0), "Campaign not found");
        require(campaign.status == CampaignStatus.Active, "Campaign inactive");
        require(_supportsEth(campaign.entryMode), "ETH disabled");
        require(quantity > 0, "Zero quantity");
        require(block.timestamp >= campaign.startTime && block.timestamp <= campaign.endTime, "Outside window");

        uint256 totalCost = campaign.ticketPriceWei * quantity;
        require(msg.value == totalCost, "Incorrect ETH");

        ethCredits[campaignId][msg.sender] += quantity;
        artistBalance[campaign.artist] += msg.value;

        emit EthEntriesPurchased(campaignId, msg.sender, quantity, msg.value);
    }

    function grantContentCredits(uint256 campaignId, address wallet, uint256 quantity) external {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.artist != address(0), "Campaign not found");
        require(campaign.status == CampaignStatus.Active, "Campaign inactive");
        require(_supportsContent(campaign.entryMode), "Content disabled");
        require(msg.sender == campaign.artist || msg.sender == owner(), "Not authorized");
        require(wallet != address(0), "Zero wallet");
        require(quantity > 0, "Zero quantity");

        contentCredits[campaignId][wallet] += quantity;

        emit ContentCreditsGranted(campaignId, wallet, quantity);
    }

    function revokeContentCredits(uint256 campaignId, address wallet, uint256 quantity) external {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.artist != address(0), "Campaign not found");
        require(msg.sender == campaign.artist || msg.sender == owner(), "Not authorized");
        require(quantity > 0, "Zero quantity");

        uint256 available = contentCredits[campaignId][wallet];
        require(available >= quantity, "Insufficient credits");

        contentCredits[campaignId][wallet] = available - quantity;

        emit ContentCreditsRevoked(campaignId, wallet, quantity);
    }

    function redeem(uint256 campaignId, uint256 quantity) external nonReentrant {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.artist != address(0), "Campaign not found");
        require(campaign.status == CampaignStatus.Active, "Campaign inactive");
        require(block.timestamp >= campaign.redeemStartTime, "Redeem locked");
        require(quantity > 0, "Zero quantity");

        uint256 redeemable = getRedeemableCount(campaignId, msg.sender);
        require(redeemable >= quantity, "Insufficient credits");
        require(campaign.minted + quantity <= campaign.maxSupply, "Supply exhausted");

        redeemedCredits[campaignId][msg.sender] += quantity;

        for (uint256 i = 0; i < quantity; i++) {
            _mintPOAP(campaignId, msg.sender);
        }

        emit RewardsRedeemed(campaignId, msg.sender, quantity);
    }

    function cancelCampaign(uint256 campaignId) external {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.artist != address(0), "Campaign not found");
        require(msg.sender == campaign.artist || msg.sender == owner(), "Not authorized");

        campaign.status = CampaignStatus.Cancelled;

        emit CampaignCancelled(campaignId);
    }

    function withdrawArtistBalance() external nonReentrant {
        uint256 amount = artistBalance[msg.sender];
        require(amount > 0, "No balance");

        artistBalance[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Transfer failed");

        emit ArtistBalanceWithdrawn(msg.sender, amount);
    }

    function getTotalCredits(uint256 campaignId, address wallet) public view returns (uint256) {
        return ethCredits[campaignId][wallet] + contentCredits[campaignId][wallet];
    }

    function getRedeemableCount(uint256 campaignId, address wallet) public view returns (uint256) {
        uint256 totalCredits = getTotalCredits(campaignId, wallet);
        uint256 redeemed = redeemedCredits[campaignId][wallet];
        return totalCredits > redeemed ? totalCredits - redeemed : 0;
    }

    function _supportsEth(EntryMode entryMode) internal pure returns (bool) {
        return entryMode == EntryMode.Eth || entryMode == EntryMode.Both;
    }

    function _supportsContent(EntryMode entryMode) internal pure returns (bool) {
        return entryMode == EntryMode.Content || entryMode == EntryMode.Both;
    }

    function _mintPOAP(uint256 campaignId, address to) internal {
        Campaign storage campaign = campaigns[campaignId];

        uint256 tokenId = nextTokenId++;
        campaign.minted += 1;
        tokenCampaign[tokenId] = campaignId;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, campaign.metadataURI);
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
