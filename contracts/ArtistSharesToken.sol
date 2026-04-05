// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ArtistSharesToken is ERC20, Ownable, ReentrancyGuard, Pausable {
    uint256 private constant REVENUE_PRECISION = 1e18;

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
    uint256 public revenuePerShareStored;

    FundraisingCampaign public campaign;

    address[] public investors;
    mapping(address => uint256) public investmentAmount;
    mapping(address => uint256) public investorShareBalance;
    mapping(address => bool) public hasInvested;
    mapping(address => uint256) public claimedRevenue;
    mapping(address => uint256) public revenueDebt;
    mapping(address => uint256) public pendingRevenue;

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
        require(balanceOf(msg.sender) >= sharesOwnedFromCampaign, "Campaign shares transferred");

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
        revenuePerShareStored += (msg.value * REVENUE_PRECISION) / totalSupply();

        emit RevenueDistributed(msg.sender, msg.value);
    }

    function claimRevenue() external nonReentrant whenNotPaused {
        _accrueRevenue(msg.sender);

        uint256 available = pendingRevenue[msg.sender];
        require(available > 0, "Nothing to claim");

        pendingRevenue[msg.sender] = 0;
        claimedRevenue[msg.sender] += available;
        totalRevenueClaimed += available;
        _syncRevenueDebt(msg.sender);

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
        return pendingRevenue[_shareholder] + _unrealizedRevenue(_shareholder);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function transfersLocked() public view returns (bool) {
        return campaign.active || (campaign.closed && campaignFailed);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == to) {
            super._update(from, to, value);
            return;
        }

        if (from != address(0) && to != address(0)) {
            require(!transfersLocked(), "Share transfers locked");
        }

        _accrueRevenue(from);
        _accrueRevenue(to);
        super._update(from, to, value);
        _syncRevenueDebt(from);
        _syncRevenueDebt(to);
    }

    function _accrueRevenue(address account) internal {
        if (account == address(0)) return;

        uint256 unrealized = _unrealizedRevenue(account);
        if (unrealized > 0) {
            pendingRevenue[account] += unrealized;
        }
    }

    function _unrealizedRevenue(address account) internal view returns (uint256) {
        if (account == address(0)) return 0;

        uint256 cumulative = (balanceOf(account) * revenuePerShareStored) / REVENUE_PRECISION;
        uint256 debt = revenueDebt[account];
        return cumulative > debt ? cumulative - debt : 0;
    }

    function _syncRevenueDebt(address account) internal {
        if (account == address(0)) return;
        revenueDebt[account] = (balanceOf(account) * revenuePerShareStored) / REVENUE_PRECISION;
    }
}
