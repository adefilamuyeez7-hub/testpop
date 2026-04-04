// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CreativeReleaseEscrow is ERC721, Ownable, ReentrancyGuard {
    struct ReleaseListing {
        uint256 id;
        address artist;
        string metadataURI;
        uint256 unitPrice;
        uint256 supply;
        uint256 sold;
        address adminWallet;
        uint256 payoutBps;
        bool active;
        uint64 createdAt;
    }

    struct ReleaseOrder {
        uint256 orderId;
        uint256 listingId;
        address buyer;
        uint256 quantity;
        uint256 totalPrice;
        uint256 creatorShare;
        uint256 platformFee;
        bool approved;
        bool released;
        bool refunded;
        string orderMetadata;
        uint64 createdAt;
    }

    uint256 public nextListingId = 1;
    uint256 public nextOrderId = 1;
    uint256 public nextTokenId = 1;
    uint256 public platformBalance;

    mapping(uint256 => ReleaseListing) public listings;
    mapping(uint256 => ReleaseOrder) public orders;
    mapping(uint256 => uint256[]) private _orderTokenIds;
    mapping(uint256 => uint256) public tokenListingIds;
    mapping(address => uint256) public creatorBalances;
    mapping(address => uint256) public buyerRefunds;

    event ReleaseListingCreated(
        uint256 indexed listingId,
        address indexed artist,
        address indexed adminWallet,
        uint256 unitPrice,
        uint256 supply
    );
    event ReleasePurchased(
        uint256 indexed orderId,
        uint256 indexed listingId,
        address indexed buyer,
        uint256 quantity,
        uint256 totalPrice
    );
    event OrderApproved(uint256 indexed orderId, address indexed adminWallet);
    event OrderReleased(uint256 indexed orderId, address indexed artist, uint256 amount);
    event OrderRefunded(uint256 indexed orderId, address indexed buyer, uint256 amount);
    event CreatorWithdrawal(address indexed artist, uint256 amount);
    event BuyerRefundWithdrawal(address indexed buyer, uint256 amount);
    event PlatformWithdrawal(address indexed owner, uint256 amount);

    constructor(address initialOwner) ERC721("POPUP Creative Release", "PCR") Ownable(initialOwner) {}

    function createReleaseListing(
        address artist,
        string calldata metadataURI,
        uint256 unitPrice,
        uint256 supply,
        address adminWallet,
        uint256 payoutBps
    ) external returns (uint256 listingId) {
        require(artist != address(0), "artist required");
        require(
            msg.sender == owner() || msg.sender == artist || (adminWallet != address(0) && msg.sender == adminWallet),
            "not authorized"
        );
        require(bytes(metadataURI).length > 0, "metadata required");
        require(unitPrice > 0, "price required");
        require(supply > 0, "supply required");
        require(payoutBps <= 10_000, "invalid bps");

        listingId = nextListingId++;
        listings[listingId] = ReleaseListing({
            id: listingId,
            artist: artist,
            metadataURI: metadataURI,
            unitPrice: unitPrice,
            supply: supply,
            sold: 0,
            adminWallet: adminWallet,
            payoutBps: payoutBps,
            active: true,
            createdAt: uint64(block.timestamp)
        });

        emit ReleaseListingCreated(listingId, artist, adminWallet, unitPrice, supply);
    }

    function buyRelease(
        uint256 listingId,
        uint256 quantity,
        string calldata orderMetadata
    ) external payable nonReentrant returns (uint256 orderId) {
        ReleaseListing storage listing = listings[listingId];
        require(listing.id != 0, "listing missing");
        require(listing.active, "listing inactive");
        require(quantity > 0, "quantity required");
        require(listing.sold + quantity <= listing.supply, "insufficient stock");

        uint256 totalPrice = listing.unitPrice * quantity;
        require(msg.value >= totalPrice, "insufficient payment");

        listing.sold += quantity;
        orderId = nextOrderId++;

        uint256 platformFee = (totalPrice * listing.payoutBps) / 10_000;
        uint256 creatorShare = totalPrice - platformFee;
        platformBalance += platformFee;

        orders[orderId] = ReleaseOrder({
            orderId: orderId,
            listingId: listingId,
            buyer: msg.sender,
            quantity: quantity,
            totalPrice: totalPrice,
            creatorShare: creatorShare,
            platformFee: platformFee,
            approved: false,
            released: false,
            refunded: false,
            orderMetadata: orderMetadata,
            createdAt: uint64(block.timestamp)
        });

        for (uint256 index = 0; index < quantity; index++) {
            uint256 tokenId = nextTokenId++;
            _safeMint(msg.sender, tokenId);
            tokenListingIds[tokenId] = listingId;
            _orderTokenIds[orderId].push(tokenId);
        }

        if (msg.value > totalPrice) {
            buyerRefunds[msg.sender] += msg.value - totalPrice;
        }

        emit ReleasePurchased(orderId, listingId, msg.sender, quantity, totalPrice);
    }

    function approveOrder(uint256 orderId) external onlyOrderAdmin(orderId) {
        ReleaseOrder storage order = orders[orderId];
        require(order.orderId != 0, "order missing");
        require(!order.refunded, "order refunded");
        order.approved = true;
        emit OrderApproved(orderId, msg.sender);
    }

    function releaseOrder(uint256 orderId) external onlyOrderAdmin(orderId) nonReentrant {
        ReleaseOrder storage order = orders[orderId];
        require(order.orderId != 0, "order missing");
        require(order.approved, "order not approved");
        require(!order.released, "already released");
        require(!order.refunded, "order refunded");

        ReleaseListing storage listing = listings[order.listingId];
        order.released = true;
        creatorBalances[listing.artist] += order.creatorShare;

        emit OrderReleased(orderId, listing.artist, order.creatorShare);
    }

    function refundOrder(uint256 orderId) external onlyOrderAdmin(orderId) nonReentrant {
        ReleaseOrder storage order = orders[orderId];
        require(order.orderId != 0, "order missing");
        require(!order.released, "already released");
        require(!order.refunded, "already refunded");

        ReleaseListing storage listing = listings[order.listingId];
        uint256[] storage tokenIds = _orderTokenIds[orderId];
        require(tokenIds.length == order.quantity, "order token tracking mismatch");

        for (uint256 index = 0; index < tokenIds.length; index++) {
            require(ownerOf(tokenIds[index]) == order.buyer, "refund requires buyer-held tokens");
        }

        for (uint256 index = 0; index < tokenIds.length; index++) {
            uint256 tokenId = tokenIds[index];
            _burn(tokenId);
            delete tokenListingIds[tokenId];
        }

        listing.sold -= order.quantity;
        delete _orderTokenIds[orderId];
        order.refunded = true;
        if (platformBalance >= order.platformFee) {
            platformBalance -= order.platformFee;
        }
        buyerRefunds[order.buyer] += order.totalPrice;

        emit OrderRefunded(orderId, order.buyer, order.totalPrice);
    }

    function claimCreatorBalance() external nonReentrant {
        uint256 amount = creatorBalances[msg.sender];
        require(amount > 0, "no creator balance");
        creatorBalances[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "creator withdrawal failed");
        emit CreatorWithdrawal(msg.sender, amount);
    }

    function claimBuyerRefund() external nonReentrant {
        uint256 amount = buyerRefunds[msg.sender];
        require(amount > 0, "no buyer refund");
        buyerRefunds[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "refund withdrawal failed");
        emit BuyerRefundWithdrawal(msg.sender, amount);
    }

    function claimPlatformBalance() external onlyOwner nonReentrant {
        uint256 amount = platformBalance;
        require(amount > 0, "no platform balance");
        platformBalance = 0;
        (bool sent, ) = payable(owner()).call{value: amount}("");
        require(sent, "platform withdrawal failed");
        emit PlatformWithdrawal(owner(), amount);
    }

    function getOrderTokenIds(uint256 orderId) external view returns (uint256[] memory) {
        return _orderTokenIds[orderId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return listings[tokenListingIds[tokenId]].metadataURI;
    }

    function setListingActive(uint256 listingId, bool active) external onlyOrderAdminForListing(listingId) {
        ReleaseListing storage listing = listings[listingId];
        require(listing.id != 0, "listing missing");
        listing.active = active;
    }

    modifier onlyOrderAdmin(uint256 orderId) {
        ReleaseOrder storage order = orders[orderId];
        require(order.orderId != 0, "order missing");
        ReleaseListing storage listing = listings[order.listingId];
        require(
            msg.sender == owner() || msg.sender == listing.adminWallet,
            "admin only"
        );
        _;
    }

    modifier onlyOrderAdminForListing(uint256 listingId) {
        ReleaseListing storage listing = listings[listingId];
        require(listing.id != 0, "listing missing");
        require(
            msg.sender == owner() || msg.sender == listing.adminWallet,
            "admin only"
        );
        _;
    }
}
