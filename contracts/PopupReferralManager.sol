// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PopupReferralManager
 * @notice Tracks artist-scoped referral programs and affiliate commissions
 * @dev Artists can toggle their own program on/off. Authorized sales contracts
 *      record conversions, while authorized payout contracts can mark them paid.
 */
contract PopupReferralManager is Ownable, ReentrancyGuard {
    uint256 public constant AFFILIATE_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DIVISOR = 10_000;

    enum PaymentMethod {
        ETH,
        USDC,
        USDT
    }

    struct ReferralCode {
        string code;
        address artist;
        bool active;
        uint256 createdAt;
        uint256 totalSalesCount;
        uint256 totalSalesAmount;
        uint256 totalCommissionEarned;
    }

    struct ReferralRecord {
        string code;
        address artist;
        address referrer;
        address buyer;
        uint256 purchaseAmount;
        uint256 commissionAmount;
        PaymentMethod paymentMethod;
        uint256 timestamp;
        bool commissionPaid;
    }

    struct AffiliateSettings {
        address artist;
        bool enabled;
        uint256 commissionRate;
        uint256 totalPending;
        uint256 totalClaimed;
    }

    mapping(string => ReferralCode) public referralCodes;
    mapping(address => string) public artistReferralCode;
    mapping(uint256 => ReferralRecord) public referralRecords;
    mapping(address => AffiliateSettings) public affiliateSettings;
    mapping(address => mapping(address => bool)) public wasReferred;
    mapping(address => bool) public authorizedCallers;

    mapping(address => uint256) public referrerPending;
    mapping(address => uint256) public referrerClaimed;
    mapping(address => uint256) public referrerTotalEarned;
    mapping(address => uint256) public referrerReferralCount;

    uint256 public referralRecordCount;

    event ReferralCodeCreated(address indexed artist, string code, uint256 timestamp);
    event AffiliateEnabled(address indexed artist, uint256 timestamp);
    event AffiliateDisabled(address indexed artist, uint256 timestamp);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event ReferralRecorded(
        string indexed code,
        address indexed artist,
        address indexed referrer,
        address buyer,
        uint256 purchaseAmount,
        uint256 commissionAmount,
        uint256 purchaseId
    );
    event CommissionPaid(address indexed referrer, uint256 indexed purchaseId, uint256 amount);
    event ReferralCancelled(address indexed referrer, uint256 indexed purchaseId, uint256 amount);

    modifier onlyAuthorizedCaller() {
        require(authorizedCallers[msg.sender], "Only authorized caller");
        _;
    }

    function createReferralCode(address artist, string calldata code) external onlyOwner {
        require(artist != address(0), "Invalid artist");
        require(bytes(code).length > 0, "Code required");
        require(referralCodes[code].artist == address(0), "Code already exists");

        referralCodes[code] = ReferralCode({
            code: code,
            artist: artist,
            active: false,
            createdAt: block.timestamp,
            totalSalesCount: 0,
            totalSalesAmount: 0,
            totalCommissionEarned: 0
        });

        artistReferralCode[artist] = code;

        if (affiliateSettings[artist].artist == address(0)) {
            affiliateSettings[artist] = AffiliateSettings({
                artist: artist,
                enabled: false,
                commissionRate: AFFILIATE_FEE_BPS,
                totalPending: 0,
                totalClaimed: 0
            });
        }

        emit ReferralCodeCreated(artist, code, block.timestamp);
    }

    function enableAffiliate(address artist) external {
        require(msg.sender == artist || msg.sender == owner(), "Not authorized");
        string memory code = artistReferralCode[artist];
        require(bytes(code).length > 0, "No referral code");

        affiliateSettings[artist].enabled = true;
        referralCodes[code].active = true;

        emit AffiliateEnabled(artist, block.timestamp);
    }

    function disableAffiliate(address artist) external {
        require(msg.sender == artist || msg.sender == owner(), "Not authorized");

        affiliateSettings[artist].enabled = false;

        string memory code = artistReferralCode[artist];
        if (bytes(code).length > 0) {
            referralCodes[code].active = false;
        }

        emit AffiliateDisabled(artist, block.timestamp);
    }

    function authorizeCaller(address caller) external onlyOwner {
        require(caller != address(0), "Invalid caller");
        authorizedCallers[caller] = true;
        emit AuthorizedCallerUpdated(caller, true);
    }

    function revokeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
        emit AuthorizedCallerUpdated(caller, false);
    }

    function validateReferralCode(string calldata code) external view returns (bool isValid, address artist) {
        ReferralCode memory rc = referralCodes[code];
        bool enabled = rc.artist != address(0) && affiliateSettings[rc.artist].enabled;
        return (rc.active && enabled && bytes(rc.code).length > 0, rc.artist);
    }

    function getCommissionAmount(uint256 purchaseAmount) external pure returns (uint256) {
        return (purchaseAmount * AFFILIATE_FEE_BPS) / BPS_DIVISOR;
    }

    function recordReferral(
        string calldata code,
        address referrer,
        address buyer,
        uint256 purchaseAmount,
        uint8 paymentMethod,
        uint256 purchaseId
    ) external onlyAuthorizedCaller nonReentrant returns (address artist, uint256 commission, bool recorded) {
        require(referrer != address(0), "Invalid referrer");
        require(buyer != address(0), "Invalid buyer");
        require(referrer != buyer, "Self-referral not allowed");
        require(purchaseAmount > 0, "Invalid amount");
        require(referralRecords[purchaseId].timestamp == 0, "Referral already recorded");

        ReferralCode storage rc = referralCodes[code];
        require(rc.artist != address(0), "Referral code missing");
        require(rc.active, "Referral inactive");
        require(affiliateSettings[rc.artist].enabled, "Affiliate disabled");

        artist = rc.artist;
        if (wasReferred[buyer][artist]) {
            return (artist, 0, false);
        }

        commission = (purchaseAmount * AFFILIATE_FEE_BPS) / BPS_DIVISOR;

        referralRecords[purchaseId] = ReferralRecord({
            code: code,
            artist: artist,
            referrer: referrer,
            buyer: buyer,
            purchaseAmount: purchaseAmount,
            commissionAmount: commission,
            paymentMethod: PaymentMethod(paymentMethod),
            timestamp: block.timestamp,
            commissionPaid: false
        });

        referralRecordCount++;

        rc.totalSalesCount += 1;
        rc.totalSalesAmount += purchaseAmount;
        rc.totalCommissionEarned += commission;

        affiliateSettings[artist].totalPending += commission;
        referrerPending[referrer] += commission;
        referrerTotalEarned[referrer] += commission;
        referrerReferralCount[referrer] += 1;
        wasReferred[buyer][artist] = true;

        emit ReferralRecorded(code, artist, referrer, buyer, purchaseAmount, commission, purchaseId);
        return (artist, commission, true);
    }

    function markCommissionAsPaid(uint256 purchaseId) external onlyAuthorizedCaller {
        ReferralRecord storage record = referralRecords[purchaseId];
        require(record.timestamp != 0, "Invalid purchase");
        require(!record.commissionPaid, "Already paid");

        record.commissionPaid = true;

        affiliateSettings[record.artist].totalPending -= record.commissionAmount;
        affiliateSettings[record.artist].totalClaimed += record.commissionAmount;
        referrerPending[record.referrer] -= record.commissionAmount;
        referrerClaimed[record.referrer] += record.commissionAmount;

        emit CommissionPaid(record.referrer, purchaseId, record.commissionAmount);
    }

    function cancelReferral(uint256 purchaseId) external onlyAuthorizedCaller returns (bool cancelled) {
        ReferralRecord storage record = referralRecords[purchaseId];
        if (record.timestamp == 0) {
            return false;
        }

        require(!record.commissionPaid, "Commission already paid");

        affiliateSettings[record.artist].totalPending -= record.commissionAmount;
        referrerPending[record.referrer] -= record.commissionAmount;
        referrerTotalEarned[record.referrer] -= record.commissionAmount;
        referrerReferralCount[record.referrer] -= 1;

        emit ReferralCancelled(record.referrer, purchaseId, record.commissionAmount);
        delete referralRecords[purchaseId];
        return true;
    }

    function getReferralCode(address artist) external view returns (string memory) {
        return artistReferralCode[artist];
    }

    function getAffiliateStats(address artist) external view returns (AffiliateSettings memory settings) {
        return affiliateSettings[artist];
    }

    function getReferralCodeDetails(string calldata code) external view returns (ReferralCode memory) {
        return referralCodes[code];
    }

    function getReferrerEarnings(address referrer) external view returns (uint256 totalEarnings, uint256 count) {
        return (referrerTotalEarned[referrer], referrerReferralCount[referrer]);
    }

    function isReferredByArtist(address buyer, address artist) external view returns (bool) {
        return wasReferred[buyer][artist];
    }
}
