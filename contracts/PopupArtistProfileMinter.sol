// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title PopupArtistProfileMinter
 * @notice Mints verified artist profile NFTs for the POPUP platform
 * @dev Handles:
 *   - Artist registration and verification
 *   - Profile NFT minting for verified artists
 *   - Badge levels and achievements
 *   - Profile metadata and on-chain reputation
 *   - Artist tier management
 */

contract PopupArtistProfileMinter is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════════════

    enum VerificationStatus {
        PENDING,
        VERIFIED,
        SUSPENDED,
        REJECTED
    }

    enum ArtistTier {
        EMERGING,    // 0-9 products
        ESTABLISHED, // 10-99 products
        FEATURED,    // 100-999 products
        LEGENDARY    // 1000+ products
    }

    struct ArtistProfile {
        address artistAddress;
        string name;
        string bio;
        string profileImageUri;
        string websiteUrl;
        VerificationStatus status;
        ArtistTier tier;
        uint256 totalProducts;
        uint256 totalEarnings;
        uint256 totalSales;
        uint256 createdAt;
        uint256 verifiedAt;
        uint256 lastUpdatedAt;
    }

    struct Badge {
        string badgeName;
        string badgeImageUri;
        string description;
        uint256 requiredProducts;
        uint256 requiredEarnings;
        bool active;
    }

    struct ArtistReputation {
        uint256 profileTokenId;
        address artist;
        uint256 totalReviews;
        uint256 averageRating; // 0-5 stars * 100 (e.g., 480 = 4.8 stars)
        uint256 totalCollaborators;
        uint256 repeatCustomers;
        uint256 communityScore; // 0-10000 basis points
        uint256 lastUpdated;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════

    // Profile management
    mapping(address => ArtistProfile) public artistProfiles;
    mapping(uint256 => ArtistProfile) public profileTokenIdToArtist;
    mapping(address => uint256) public artistToProfileTokenId;

    // Verification
    mapping(address => bool) public verifiedArtists;
    mapping(address => uint256) public pendingVerifications;
    address[] public verificationQueue;

    // Badges and achievements
    mapping(uint256 => Badge) public badges;
    mapping(address => uint256[]) public artistBadges; // artist badges earned
    uint256 public badgeCounter;

    // Reputation system
    mapping(address => ArtistReputation) public artistReputations;

    // Tier management
    mapping(ArtistTier => uint256) public tierBenefits; // commission benefits per tier

    // Counters
    uint256 public profileTokenIdCounter = 1;
    uint256 public totalVerifiedArtists;

    // Platform settings
    uint256 public verificationFee = 0.1 ether; // can be 0
    uint256 public platformFeeBps = 500; // 5% commission
    address public platformTreasury;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event ArtistRegistered(
        address indexed artist,
        string name,
        uint256 timestamp
    );

    event ArtistVerified(
        address indexed artist,
        uint256 profileTokenId,
        uint256 timestamp
    );

    event ProfileMinted(
        address indexed artist,
        uint256 tokenId,
        string name,
        uint256 timestamp
    );

    event ProfileUpdated(
        address indexed artist,
        string newName,
        string newBio,
        uint256 timestamp
    );

    event TierUpgraded(
        address indexed artist,
        ArtistTier oldTier,
        ArtistTier newTier,
        uint256 timestamp
    );

    event BadgeEarned(
        address indexed artist,
        uint256 badgeId,
        string badgeName,
        uint256 timestamp
    );

    event ReputationUpdated(
        address indexed artist,
        uint256 newCommunityScore,
        uint256 timestamp
    );

    event ArtistSuspended(
        address indexed artist,
        string reason,
        uint256 timestamp
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════

    constructor(address _platformTreasury) ERC721("POPUP Artist Profile", "POPUP-AP") {
        platformTreasury = _platformTreasury;
        
        // Initialize tier benefits (commission reduction in basis points)
        tierBenefits[ArtistTier.EMERGING] = 500;    // 5% commission
        tierBenefits[ArtistTier.ESTABLISHED] = 400; // 4% commission
        tierBenefits[ArtistTier.FEATURED] = 300;    // 3% commission
        tierBenefits[ArtistTier.LEGENDARY] = 200;   // 2% commission
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ARTIST REGISTRATION & VERIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Register as an artist (creates pending profile, requires verification)
     * @param _name Artist display name
     * @param _bio Artist biography
     * @param _profileImageUri IPFS URI for profile picture
     * @param _websiteUrl Artist website or social media
     */
    function registerArtist(
        string memory _name,
        string memory _bio,
        string memory _profileImageUri,
        string memory _websiteUrl
    ) external payable nonReentrant returns (uint256) {
        require(artistProfiles[msg.sender].artistAddress == address(0), "Already registered");
        require(bytes(_name).length > 0, "Name required");
        require(bytes(_name).length <= 100, "Name too long");

        // Create pending profile
        artistProfiles[msg.sender] = ArtistProfile({
            artistAddress: msg.sender,
            name: _name,
            bio: _bio,
            profileImageUri: _profileImageUri,
            websiteUrl: _websiteUrl,
            status: VerificationStatus.PENDING,
            tier: ArtistTier.EMERGING,
            totalProducts: 0,
            totalEarnings: 0,
            totalSales: 0,
            createdAt: block.timestamp,
            verifiedAt: 0,
            lastUpdatedAt: block.timestamp
        });

        // Add to verification queue
        verificationQueue.push(msg.sender);
        pendingVerifications[msg.sender] = block.timestamp;

        emit ArtistRegistered(msg.sender, _name, block.timestamp);

        return profileTokenIdCounter;
    }

    /**
     * @notice Verify an artist and mint their profile NFT (admin only)
     * @param _artistAddress Address of artist to verify
     */
    function verifyArtist(address _artistAddress) external onlyOwner nonReentrant {
        ArtistProfile storage profile = artistProfiles[_artistAddress];
        require(profile.artistAddress != address(0), "Artist not found");
        require(profile.status == VerificationStatus.PENDING, "Not pending");

        // Update status
        profile.status = VerificationStatus.VERIFIED;
        profile.verifiedAt = block.timestamp;
        verifiedArtists[_artistAddress] = true;
        totalVerifiedArtists++;

        // Mint profile NFT
        uint256 tokenId = profileTokenIdCounter++;
        _safeMint(_artistAddress, tokenId);
        
        profileTokenIdToArtist[tokenId] = profile;
        artistToProfileTokenId[_artistAddress] = tokenId;

        // Initialize reputation
        artistReputations[_artistAddress] = ArtistReputation({
            profileTokenId: tokenId,
            artist: _artistAddress,
            totalReviews: 0,
            averageRating: 0,
            totalCollaborators: 0,
            repeatCustomers: 0,
            communityScore: 3000, // Start with 3.0 / 10
            lastUpdated: block.timestamp
        });

        emit ArtistVerified(_artistAddress, tokenId, block.timestamp);
        emit ProfileMinted(
            _artistAddress,
            tokenId,
            profile.name,
            block.timestamp
        );
    }

    /**
     * @notice Reject an artist's verification application (admin only)
     * @param _artistAddress Address to reject
     */
    function rejectArtist(address _artistAddress) external onlyOwner {
        ArtistProfile storage profile = artistProfiles[_artistAddress];
        require(profile.status == VerificationStatus.PENDING, "Not pending");

        profile.status = VerificationStatus.REJECTED;
    }

    /**
     * @notice Suspend a verified artist (admin only, for violations)
     * @param _artistAddress Artist to suspend
     * @param _reason Suspension reason
     */
    function suspendArtist(address _artistAddress, string memory _reason) external onlyOwner {
        require(verifiedArtists[_artistAddress], "Not verified");
        
        ArtistProfile storage profile = artistProfiles[_artistAddress];
        profile.status = VerificationStatus.SUSPENDED;

        emit ArtistSuspended(_artistAddress, _reason, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PROFILE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update artist profile information
     * @param _name New artist name
     * @param _bio New biography
     * @param _profileImageUri New profile image
     * @param _websiteUrl New website
     */
    function updateProfile(
        string memory _name,
        string memory _bio,
        string memory _profileImageUri,
        string memory _websiteUrl
    ) external nonReentrant {
        require(verifiedArtists[msg.sender], "Not verified");
        
        ArtistProfile storage profile = artistProfiles[msg.sender];
        profile.name = _name;
        profile.bio = _bio;
        profile.profileImageUri = _profileImageUri;
        profile.websiteUrl = _websiteUrl;
        profile.lastUpdatedAt = block.timestamp;

        emit ProfileUpdated(msg.sender, _name, _bio, block.timestamp);
    }

    /**
     * @notice Update artist statistics (called by ProductStore)
     * @param _artist Artist address
     * @param _productCreated Whether a new product was created
     * @param _earnings Earnings amount
     * @param _sales Number of sales
     */
    function updateArtistStats(
        address _artist,
        bool _productCreated,
        uint256 _earnings,
        uint256 _sales
    ) external nonReentrant {
        require(verifiedArtists[_artist], "Not verified");

        ArtistProfile storage profile = artistProfiles[_artist];
        
        if (_productCreated) {
            profile.totalProducts++;
        }
        profile.totalEarnings += _earnings;
        profile.totalSales += _sales;

        // Check for tier upgrade
        _checkAndUpgradeTier(_artist);
    }

    /**
     * @notice Check if artist qualifies for tier upgrade
     * @param _artist Artist to check
     */
    function _checkAndUpgradeTier(address _artist) internal {
        ArtistProfile storage profile = artistProfiles[_artist];
        ArtistTier oldTier = profile.tier;

        if (profile.totalProducts >= 1000) {
            profile.tier = ArtistTier.LEGENDARY;
        } else if (profile.totalProducts >= 100) {
            profile.tier = ArtistTier.FEATURED;
        } else if (profile.totalProducts >= 10) {
            profile.tier = ArtistTier.ESTABLISHED;
        }

        if (oldTier != profile.tier) {
            emit TierUpgraded(_artist, oldTier, profile.tier, block.timestamp);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BADGE SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Add a new badge type (admin only)
     * @param _name Badge name
     * @param _imageUri Badge image URI
     * @param _description Badge description
     * @param _requiredProducts Products needed to earn
     * @param _requiredEarnings Earnings needed to earn
     */
    function createBadge(
        string memory _name,
        string memory _imageUri,
        string memory _description,
        uint256 _requiredProducts,
        uint256 _requiredEarnings
    ) external onlyOwner returns (uint256) {
        uint256 badgeId = badgeCounter++;
        
        badges[badgeId] = Badge({
            badgeName: _name,
            badgeImageUri: _imageUri,
            description: _description,
            requiredProducts: _requiredProducts,
            requiredEarnings: _requiredEarnings,
            active: true
        });

        return badgeId;
    }

    /**
     * @notice Award badge to artist (called by system)
     * @param _artist Artist to award badge to
     * @param _badgeId Badge to award
     */
    function awardBadge(address _artist, uint256 _badgeId) external onlyOwner nonReentrant {
        require(verifiedArtists[_artist], "Not verified");
        require(badges[_badgeId].active, "Badge inactive");

        Badge memory badge = badges[_badgeId];
        ArtistProfile memory profile = artistProfiles[_artist];
        
        // Check if artist qualifies
        require(
            profile.totalProducts >= badge.requiredProducts &&
            profile.totalEarnings >= badge.requiredEarnings,
            "Doesn't qualify"
        );

        // Award badge
        artistBadges[_artist].push(_badgeId);

        emit BadgeEarned(_artist, _badgeId, badge.badgeName, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REPUTATION SYSTEM
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update artist reputation metrics (called by external system)
     * @param _artist Artist address
     * @param _averageRating Average customer rating (0-500, where 500 = 5.0 stars)
     * @param _communityScore Community/platform score (0-10000)
     */
    function updateReputation(
        address _artist,
        uint256 _averageRating,
        uint256 _communityScore
    ) external onlyOwner nonReentrant {
        require(verifiedArtists[_artist], "Not verified");

        ArtistReputation storage rep = artistReputations[_artist];
        rep.averageRating = _averageRating;
        rep.communityScore = _communityScore;
        rep.lastUpdated = block.timestamp;

        emit ReputationUpdated(_artist, _communityScore, block.timestamp);
    }

    /**
     * @notice Record a collaboration between artists
     * @param _collaborators Array of collaborating artist addresses
     */
    function recordCollaboration(address[] calldata _collaborators) external onlyOwner {
        for (uint256 i = 0; i < _collaborators.length; i++) {
            if (verifiedArtists[_collaborators[i]]) {
                artistReputations[_collaborators[i]].totalCollaborators++;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TOKEN METADATA
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Generate on-chain token metadata with artist profile and stats
     * @param _tokenId Profile token ID
     */
    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_ownerOf(_tokenId) != address(0), "Token doesn't exist");

        ArtistProfile memory profile = profileTokenIdToArtist[_tokenId];
        ArtistReputation memory rep = artistReputations[profile.artistAddress];

        // Build JSON metadata
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"',
                        profile.name,
                        ' - POPUP Artist Profile","description":"',
                        profile.bio,
                        '","image":"',
                        profile.profileImageUri,
                        '","attributes":[',
                        '{"trait_type":"Tier","value":"',
                        _tierToString(profile.tier),
                        '"},',
                        '{"trait_type":"Status","value":"',
                        _statusToString(profile.status),
                        '"},',
                        '{"trait_type":"Total Products","value":',
                        Strings.toString(profile.totalProducts),
                        '},',
                        '{"trait_type":"Total Earnings","value":',
                        Strings.toString(profile.totalEarnings),
                        '},',
                        '{"trait_type":"Total Sales","value":',
                        Strings.toString(profile.totalSales),
                        '},',
                        '{"trait_type":"Community Score","value":',
                        Strings.toString(rep.communityScore),
                        '},',
                        '{"trait_type":"Average Rating","value":"',
                        _formatRating(rep.averageRating),
                        '"}',
                        "]}"
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /**
     * @notice Convert tier enum to string
     */
    function _tierToString(ArtistTier _tier) internal pure returns (string memory) {
        if (_tier == ArtistTier.LEGENDARY) return "Legendary";
        if (_tier == ArtistTier.FEATURED) return "Featured";
        if (_tier == ArtistTier.ESTABLISHED) return "Established";
        return "Emerging";
    }

    /**
     * @notice Convert status enum to string
     */
    function _statusToString(VerificationStatus _status) internal pure returns (string memory) {
        if (_status == VerificationStatus.VERIFIED) return "Verified";
        if (_status == VerificationStatus.SUSPENDED) return "Suspended";
        if (_status == VerificationStatus.REJECTED) return "Rejected";
        return "Pending";
    }

    /**
     * @notice Format rating (e.g., 480 -> "4.8")
     */
    function _formatRating(uint256 _rating) internal pure returns (string memory) {
        uint256 wholePart = _rating / 100;
        uint256 decimalPart = _rating % 100;
        
        return string(abi.encodePacked(
            Strings.toString(wholePart),
            ".",
            decimalPart < 10 ? "0" : "",
            Strings.toString(decimalPart)
        ));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get artist profile by address
     */
    function getArtistProfile(address _artist)
        external
        view
        returns (ArtistProfile memory)
    {
        return artistProfiles[_artist];
    }

    /**
     * @notice Get artist reputation by address
     */
    function getArtistReputation(address _artist)
        external
        view
        returns (ArtistReputation memory)
    {
        return artistReputations[_artist];
    }

    /**
     * @notice Get artist's badges
     */
    function getArtistBadges(address _artist)
        external
        view
        returns (uint256[] memory)
    {
        return artistBadges[_artist];
    }

    /**
     * @notice Get verification queue length
     */
    function getVerificationQueueLength() external view returns (uint256) {
        return verificationQueue.length;
    }

    /**
     * @notice Get next artist in verification queue
     */
    function getNextArtistToVerify() external view returns (address) {
        if (verificationQueue.length == 0) return address(0);
        return verificationQueue[0];
    }

    /**
     * @notice Get tier commission benefit
     */
    function getTierBenefit(ArtistTier _tier) external view returns (uint256) {
        return tierBenefits[_tier];
    }

    /**
     * @notice Check if artist is verified
     */
    function isArtistVerified(address _artist) external view returns (bool) {
        return verifiedArtists[_artist];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OWNERSHIP
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get owner of profile token (returns the artist)
     */
    function _ownerOf(uint256 _tokenId) internal view override returns (address owner) {
        return super.ownerOf(_tokenId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Update platform treasury address
     */
    function setPlatformTreasury(address _newTreasury) external onlyOwner {
        platformTreasury = _newTreasury;
    }

    /**
     * @notice Update platform fee percentage
     */
    function setPlatformFee(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 5000, "Fee too high"); // Max 50%
        platformFeeBps = _newFeeBps;
    }

    /**
     * @notice Update verification fee
     */
    function setVerificationFee(uint256 _newFee) external onlyOwner {
        verificationFee = _newFee;
    }

    /**
     * @notice Withdraw platform fees
     */
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = payable(platformTreasury).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    receive() external payable {}
}
