// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title ArtDropFactory
 * @notice Factory contract to deploy individual ArtDrop contracts for each artist
 * @dev Each artist gets their own ArtDrop instance with their address and founder wallet configured
 */

contract ArtDropFactory {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────
    struct ArtistDeployment {
        uint256 deploymentTime;
        address artDropContract;
        bool active;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────
    address public owner;
    address public founderWallet;
    bytes public artDropBytecode;
    
    // Track all deployed contracts
    mapping(address => address) public artistToContract;  // artist → contract
    mapping(address => address) public contractToArtist;  // contract → artist
    mapping(address => ArtistDeployment) public deployments;
    address[] public allDeployedContracts;
    
    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────
    event ArtDropDeployed(
        address indexed artist,
        address indexed artDropContract,
        address indexed founder,
        uint256 timestamp
    );
    
    event ArtDropBytecodeSet(uint256 bytecodeLength);
    
    event FactoryOwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    event FounderWalletUpdated(address indexed previousFounder, address indexed newFounder);

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────
    constructor(address _founderWallet) {
        require(_founderWallet != address(0), "Invalid founder wallet");
        owner = msg.sender;
        founderWallet = _founderWallet;
    }

    // ──────────────────────────────────────────────
    //  Owner functions
    // ──────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid new owner");
        address previousOwner = owner;
        owner = _newOwner;
        emit FactoryOwnershipTransferred(previousOwner, _newOwner);
    }

    function updateFounderWallet(address _newFounder) external onlyOwner {
        require(_newFounder != address(0), "Invalid founder wallet");
        address previousFounder = founderWallet;
        founderWallet = _newFounder;
        emit FounderWalletUpdated(previousFounder, _newFounder);
    }

    function setArtDropBytecode(bytes calldata _bytecode) external onlyOwner {
        require(_bytecode.length > 0, "Empty bytecode");
        artDropBytecode = _bytecode;
        emit ArtDropBytecodeSet(_bytecode.length);
    }

    // ──────────────────────────────────────────────
    //  Core deployment function
    // ──────────────────────────────────────────────
    /// @dev Deploys a new ArtDrop contract for the given artist wallet
    function deployArtDrop(address _artistWallet) external onlyOwner returns (address) {
        require(_artistWallet != address(0), "Invalid artist wallet");
        require(artistToContract[_artistWallet] == address(0), "Artist already has contract");
        
        bytes memory bytecode = artDropBytecode;
        require(bytecode.length > 0, "Bytecode not set");
        
        // Deploy new ArtDrop contract
        address newContract = _deployContract(_artistWallet, bytecode);
        
        // Track the deployment - consolidated storage writes
        artistToContract[_artistWallet] = newContract;
        contractToArtist[newContract] = _artistWallet;
        
        ArtistDeployment storage deployment = deployments[newContract];
        deployment.artDropContract = newContract;
        deployment.deploymentTime = block.timestamp;
        deployment.active = true;
        
        allDeployedContracts.push(newContract);
        
        emit ArtDropDeployed(_artistWallet, newContract, founderWallet, block.timestamp);
        
        return newContract;
    }

    // ──────────────────────────────────────────────
    //  Internal functions
    // ──────────────────────────────────────────────
    /// @dev Deploys contract bytecode with constructor args using CREATE
    function _deployContract(address _artistWallet, bytes memory _bytecode) internal returns (address) {
        bytes memory constructorArgs = abi.encode(_artistWallet, founderWallet);
        bytes memory deploymentBytecode = abi.encodePacked(_bytecode, constructorArgs);
        
        address deployed;
        assembly {
            deployed := create(0, add(deploymentBytecode, 0x20), mload(deploymentBytecode))
            if iszero(deployed) { revert(0, 0) }
        }
        
        return deployed;
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────
    /// @dev Get the ArtDrop contract for an artist
    function getArtistContract(address _artist) external view returns (address) {
        return artistToContract[_artist];
    }

    /// @dev Get the artist address for a deployed contract
    function getContractArtist(address _contract) external view returns (address) {
        return contractToArtist[_contract];
    }

    /// @dev Get all deployed contract addresses
    function getAllDeployedContracts() external view returns (address[] memory) {
        return allDeployedContracts;
    }

    /// @dev Get count of deployed contracts
    function getDeploymentCount() external view returns (uint256) {
        return allDeployedContracts.length;
    }

    /// @dev Check if address is a deployed ArtDrop contract
    function isDeployedContract(address _contract) external view returns (bool) {
        return contractToArtist[_contract] != address(0);
    }
}
