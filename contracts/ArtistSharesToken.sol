// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ArtistSharesToken is ERC20, Ownable, ReentrancyGuard, Pausable {
    struct FundraisingCampaign {
        uint256 targetAmount;
        uint256 amountRaised;
        uint256 pricePerShare;
        uint64 startTime;
        uint64 endTime;
        bool active;
        bool closed;
    }

    address public immutable artist;
    uint256 public totalShares;
    uint256 public totalRevenueDistributed;
    uint256 public totalRevenueClaimed;
    uint256 public pendingRefundLiability;

    FundraisingCampaign public campaign;

    address[] public investors;
    mapping(address => uint256) public investmentAmount;
    mapping(address => uint256) public investorShareBalance;
    mapping(address => bool) public hasInvested;
    mapping(address => uint256) public claimedRevenue;

    bool public campaignFailed;
    bool public campaignProceedsWithdrawn;

    event CampaignStarted(uint256 targetAmount, uint256 pricePerShare, uint64 endTime);
    event SharesPurchased(address indexed buyer, uint256 shares, uint256 amountPaid);
    event CampaignEnded(uint256 totalRaised, bool successful);
    event CampaignProceedsWithdrawn(address indexed artist, uint256 amount);
    event RevenueDistributed(address indexed distributor, uint256 totalAmount);
    event ShareholderClaimed(address indexed shareholder, uint256 amount);
    event CampaignRefundClaimed(address indexed investor, uint256 amount, uint256 sharesBurned);
    event EmergencyPaused(address indexed by);
    event EmergencyUnpaused(address indexed by);
    event SurplusRecovered(address indexed to, uint256 amount);
    event ERC20Recovered(address indexed token, address indexed to, uint256 amount);

    modifier onlyArtistOrOwner() {
        require(msg.sender == artist || msg.sender == owner(), "Only artist or owner");
        _;
    }

    constructor(address _artist) ERC20("Artist Shares", "SHARES") Ownable(msg.sender) {
        require(_artist != address(0), "Invalid artist");
        artist = _artist;
    }

    function launchCampaign(uint256 _targetAmount, uint256 _sharesForTarget, uint256 _durationDays) external whenNotPaused {
        require(msg.sender == artist, "Only artist");
        require(!campaign.active && !campaign.closed, "Campaign already active");
        require(_targetAmount > 0, "Target must be > 0");
        require(_sharesForTarget > 0, "Shares must be > 0");
        require(_durationDays > 0 && _durationDays <= 365, "Duration 1-365 days");

        uint256 pricePerShare = (_targetAmount * 1e18) / _sharesForTarget;

        campaign = FundraisingCampaign({
            targetAmount: _targetAmount,
            amountRaised: 0,
            pricePerShare: pricePerShare,
            startTime: uint64(block.timestamp),
            endTime: uint64(block.timestamp + _durationDays * 1 days),
            active: true,
            closed: false
        });

        totalShares = _sharesForTarget;
        campaignFailed = false;
        campaignProceedsWithdrawn = false;
        pendingRefundLiability = 0;

        emit CampaignStarted(_targetAmount, pricePerShare, campaign.endTime);
    }

    function buyShares(uint256 _amountEth) external payable nonReentrant whenNotPaused {
        require(campaign.active, "No active campaign");
        require(block.timestamp <= campaign.endTime, "Campaign ended");
        require(_amountEth > 0, "Amount must be > 0");
        require(msg.value == _amountEth, "Value mismatch");

        uint256 sharesToMint = (_amountEth * 1e18) / campaign.pricePerShare;
        require(sharesToMint > 0, "Too small");

        uint256 newTotal = campaign.amountRaised + _amountEth;
        require(newTotal <= campaign.targetAmount, "Would exceed target");

        campaign.amountRaised = newTotal;
        pendingRefundLiability += _amountEth;

        if (!hasInvested[msg.sender]) {
            investors.push(msg.sender);
            hasInvested[msg.sender] = true;
        }

        investmentAmount[msg.sender] += _amountEth;
        investorShareBalance[msg.sender] += sharesToMint;
        _mint(msg.sender, sharesToMint);

        emit SharesPurchased(msg.sender, sharesToMint, _amountEth);
    }

    function closeCampaign() external nonReentrant whenNotPaused {
        require(msg.sender == artist, "Only artist");
        require(campaign.active, "No active campaign");

        campaign.active = false;
        campaign.closed = true;

        bool successful = campaign.amountRaised >= campaign.targetAmount;
        campaignFailed = !successful;

        if (successful) {
            pendingRefundLiability = 0;
        }

        emit CampaignEnded(campaign.amountRaised, successful);
    }

    function withdrawCampaignProceeds() external nonReentrant whenNotPaused {
        require(msg.sender == artist, "Only artist");
        require(campaign.closed, "Campaign not closed");
        require(!campaignFailed, "Campaign failed");
        require(!campaignProceedsWithdrawn, "Already withdrawn");

        uint256 amount = campaign.amountRaised;
        require(amount > 0, "No proceeds");

        campaignProceedsWithdrawn = true;

        (bool ok, ) = artist.call{value: amount}("");
        require(ok, "Withdraw failed");

        emit CampaignProceedsWithdrawn(artist, amount);
    }

    function claimPendingRefund() external nonReentrant whenNotPaused {
        require(campaign.closed, "Campaign not closed");
        require(campaignFailed, "Campaign succeeded");

        uint256 amount = investmentAmount[msg.sender];
        require(amount > 0, "No refund available");

        uint256 sharesOwnedFromCampaign = investorShareBalance[msg.sender];
        require(sharesOwnedFromCampaign > 0, "No campaign shares");

        investmentAmount[msg.sender] = 0;
        investorShareBalance[msg.sender] = 0;
        pendingRefundLiability -= amount;

        _burn(msg.sender, sharesOwnedFromCampaign);

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "Refund failed");

        emit CampaignRefundClaimed(msg.sender, amount, sharesOwnedFromCampaign);
    }

    function getInvestorCount() external view returns (uint256) {
        return investors.length;
    }

    function getInvestor(uint256 _index) external view returns (address) {
        require(_index < investors.length, "Invalid index");
        return investors[_index];
    }

    function getInvestorAmount(address _investor) external view returns (uint256) {
        return investmentAmount[_investor];
    }

    function distributeRevenue() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No revenue");
        require(totalSupply() > 0, "No shareholders");

        totalRevenueDistributed += msg.value;

        emit RevenueDistributed(msg.sender, msg.value);
    }

    function claimRevenue() external nonReentrant whenNotPaused {
        uint256 holderShares = balanceOf(msg.sender);
        require(holderShares > 0, "No shares");

        uint256 holderPct = (holderShares * 1e18) / totalSupply();
        uint256 claimableAmount = (totalRevenueDistributed * holderPct) / 1e18;
        uint256 alreadyClaimed = claimedRevenue[msg.sender];
        uint256 available = claimableAmount - alreadyClaimed;

        require(available > 0, "Nothing to claim");

        claimedRevenue[msg.sender] = claimableAmount;
        totalRevenueClaimed += available;

        (bool ok, ) = msg.sender.call{value: available}("");
        require(ok, "Transfer failed");

        emit ShareholderClaimed(msg.sender, available);
    }

    function pause() external onlyArtistOrOwner {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyArtistOrOwner {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    function outstandingObligations() public view returns (uint256) {
        uint256 outstandingRevenue = totalRevenueDistributed - totalRevenueClaimed;
        return pendingRefundLiability + outstandingRevenue;
    }

    function availableSurplus() public view returns (uint256) {
        uint256 obligations = outstandingObligations();
        if (address(this).balance <= obligations) return 0;
        return address(this).balance - obligations;
    }

    function recoverSurplusETH(address payable to, uint256 amount) external onlyOwner nonReentrant whenPaused {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(amount <= availableSurplus(), "Amount exceeds surplus");

        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Surplus recovery failed");

        emit SurplusRecovered(to, amount);
    }

    function recoverAccidentalERC20(address token, address to, uint256 amount) external onlyOwner whenPaused {
        require(token != address(0), "Invalid token");
        require(to != address(0), "Invalid recipient");
        require(IERC20(token).transfer(to, amount), "ERC20 transfer failed");

        emit ERC20Recovered(token, to, amount);
    }

    function getCampaignStatus()
        external
        view
        returns (
            uint256 target,
            uint256 raised,
            uint256 pricePerShare,
            uint64 endTime,
            bool active
        )
    {
        return (campaign.targetAmount, campaign.amountRaised, campaign.pricePerShare, campaign.endTime, campaign.active);
    }

    function getRevenueClaim(address _shareholder) external view returns (uint256 claimable) {
        uint256 holderShares = balanceOf(_shareholder);
        if (holderShares == 0 || totalSupply() == 0) return 0;

        uint256 holderPct = (holderShares * 1e18) / totalSupply();
        uint256 claimableAmount = (totalRevenueDistributed * holderPct) / 1e18;
        uint256 alreadyClaimed = claimedRevenue[_shareholder];

        return claimableAmount > alreadyClaimed ? claimableAmount - alreadyClaimed : 0;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
