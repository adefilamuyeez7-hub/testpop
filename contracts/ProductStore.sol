// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ProductStore is Ownable, ReentrancyGuard {
    struct Product {
        uint256 id;
        address creator;
        string metadataURI;
        uint256 price;
        uint256 stock;
        uint256 sold;
        uint256 royaltyPercent;
        bool active;
        uint64 createdAt;
    }

    struct Order {
        uint256 orderId;
        address buyer;
        uint256 productId;
        uint256 quantity;
        uint256 totalPrice;
        string orderMetadata;
        uint256 timestamp;
        bool fulfilled;
    }

    struct CartItem {
        uint256 productId;
        uint256 quantity;
    }

    uint256 public nextProductId = 1;
    uint256 public nextOrderId = 1;

    mapping(uint256 => Product) public products;
    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public userOrders;
    mapping(address => uint256) public artistBalances;
    uint256 public platformBalance;
    mapping(address => uint256) public pendingBuyerRefunds;
    mapping(address => CartItem[]) public carts;

    uint256 public platformCommissionPercent = 5;

    event ProductCreated(uint256 indexed productId, address indexed creator, uint256 price, uint256 royaltyPercent);
    event ProductUpdated(uint256 indexed productId, bool active);
    event ProductAddedToCart(address indexed buyer, uint256 indexed productId, uint256 quantity);
    event ProductRemovedFromCart(address indexed buyer, uint256 indexed productId);
    event CartCleared(address indexed buyer);
    event PurchaseCompleted(uint256 indexed orderId, address indexed buyer, uint256 indexed productId, uint256 quantity, uint256 totalPrice);
    event ArtistWithdrawal(address indexed artist, uint256 amount);
    event PlatformWithdrawal(address indexed owner, uint256 amount);
    event BuyerRefundQueued(address indexed buyer, uint256 amount);
    event BuyerRefundClaimed(address indexed buyer, uint256 amount);
    event ProductFulfilled(uint256 indexed orderId);

    constructor() Ownable(msg.sender) {}

    function createProduct(
        string calldata _metadataURI,
        uint256 _price,
        uint256 _stock,
        uint256 _royaltyPercent
    ) external returns (uint256) {
        require(_price > 0, "Price must be > 0");
        require(_royaltyPercent <= 100, "Royalty must be 0-100");
        require(bytes(_metadataURI).length > 0, "Metadata URI required");

        uint256 productId = nextProductId++;

        products[productId] = Product({
            id: productId,
            creator: msg.sender,
            metadataURI: _metadataURI,
            price: _price,
            stock: _stock,
            sold: 0,
            royaltyPercent: _royaltyPercent,
            active: true,
            createdAt: uint64(block.timestamp)
        });

        emit ProductCreated(productId, msg.sender, _price, _royaltyPercent);
        return productId;
    }

    function updateProductStatus(uint256 _productId, bool _active) external {
        Product storage product = products[_productId];
        require(product.creator == msg.sender, "Only creator can update");
        product.active = _active;
        emit ProductUpdated(_productId, _active);
    }

    function addToCart(uint256 _productId, uint256 _quantity) external {
        Product storage product = products[_productId];
        require(product.active, "Product not active");
        require(_quantity > 0, "Quantity must be > 0");

        if (product.stock > 0) {
            require(product.sold + _quantity <= product.stock, "Insufficient stock");
        }

        CartItem[] storage cart = carts[msg.sender];
        bool found = false;
        for (uint256 i = 0; i < cart.length; i++) {
            if (cart[i].productId == _productId) {
                cart[i].quantity += _quantity;
                found = true;
                break;
            }
        }

        if (!found) {
            cart.push(CartItem(_productId, _quantity));
        }

        emit ProductAddedToCart(msg.sender, _productId, _quantity);
    }

    function removeFromCart(uint256 _productId) external {
        CartItem[] storage cart = carts[msg.sender];
        for (uint256 i = 0; i < cart.length; i++) {
            if (cart[i].productId == _productId) {
                cart[i] = cart[cart.length - 1];
                cart.pop();
                emit ProductRemovedFromCart(msg.sender, _productId);
                return;
            }
        }

        revert("Product not in cart");
    }

    function getCart(address _user) external view returns (CartItem[] memory) {
        return carts[_user];
    }

    function clearCart() external {
        delete carts[msg.sender];
        emit CartCleared(msg.sender);
    }

    function _queueBuyerRefund(address buyer, uint256 amount) internal {
        if (amount == 0) return;
        pendingBuyerRefunds[buyer] += amount;
        emit BuyerRefundQueued(buyer, amount);
    }

    function buyProduct(
        uint256 _productId,
        uint256 _quantity,
        string calldata _orderMetadata
    ) external payable nonReentrant returns (uint256) {
        Product storage product = products[_productId];
        require(product.active, "Product not active");
        require(_quantity > 0, "Quantity must be > 0");

        if (product.stock > 0) {
            require(product.sold + _quantity <= product.stock, "Insufficient stock");
        }

        uint256 totalPrice = product.price * _quantity;
        require(msg.value >= totalPrice, "Insufficient payment");

        product.sold += _quantity;

        uint256 platformFee = (totalPrice * platformCommissionPercent) / 100;
        uint256 artistRoyalty = totalPrice - platformFee;

        platformBalance += platformFee;
        artistBalances[product.creator] += artistRoyalty;

        uint256 orderId = nextOrderId++;
        orders[orderId] = Order({
            orderId: orderId,
            buyer: msg.sender,
            productId: _productId,
            quantity: _quantity,
            totalPrice: totalPrice,
            orderMetadata: _orderMetadata,
            timestamp: block.timestamp,
            fulfilled: false
        });

        userOrders[msg.sender].push(orderId);

        emit PurchaseCompleted(orderId, msg.sender, _productId, _quantity, totalPrice);

        if (msg.value > totalPrice) {
            _queueBuyerRefund(msg.sender, msg.value - totalPrice);
        }

        return orderId;
    }

    function checkoutCart(string calldata _orderMetadata) external payable nonReentrant returns (uint256[] memory) {
        CartItem[] storage cart = carts[msg.sender];
        require(cart.length > 0, "Cart is empty");

        uint256[] memory orderIds = new uint256[](cart.length);
        uint256 totalValue = 0;

        for (uint256 i = 0; i < cart.length; i++) {
            Product storage product = products[cart[i].productId];
            require(product.active, "Product not active");
            totalValue += product.price * cart[i].quantity;
        }

        require(msg.value >= totalValue, "Insufficient payment");

        for (uint256 i = 0; i < cart.length; i++) {
            uint256 productId = cart[i].productId;
            uint256 quantity = cart[i].quantity;
            Product storage product = products[productId];

            if (product.stock > 0) {
                require(product.sold + quantity <= product.stock, "Insufficient stock");
            }

            product.sold += quantity;

            uint256 itemTotal = product.price * quantity;
            uint256 platformFee = (itemTotal * platformCommissionPercent) / 100;
            uint256 artistRoyalty = itemTotal - platformFee;

            platformBalance += platformFee;
            artistBalances[product.creator] += artistRoyalty;

            uint256 orderId = nextOrderId++;
            orders[orderId] = Order({
                orderId: orderId,
                buyer: msg.sender,
                productId: productId,
                quantity: quantity,
                totalPrice: itemTotal,
                orderMetadata: _orderMetadata,
                timestamp: block.timestamp,
                fulfilled: false
            });

            userOrders[msg.sender].push(orderId);
            orderIds[i] = orderId;

            emit PurchaseCompleted(orderId, msg.sender, productId, quantity, itemTotal);
        }

        if (msg.value > totalValue) {
            _queueBuyerRefund(msg.sender, msg.value - totalValue);
        }

        delete carts[msg.sender];
        emit CartCleared(msg.sender);

        return orderIds;
    }

    function fulfillOrder(uint256 _orderId) external {
        Order storage order = orders[_orderId];
        Product storage product = products[order.productId];
        require(product.creator == msg.sender, "Only creator can fulfill");
        require(!order.fulfilled, "Already fulfilled");

        order.fulfilled = true;
        emit ProductFulfilled(_orderId);
    }

    function getUserOrders(address _user) external view returns (uint256[] memory) {
        return userOrders[_user];
    }

    function getOrder(uint256 _orderId) external view returns (Order memory) {
        return orders[_orderId];
    }

    function withdrawArtistBalance() external nonReentrant {
        uint256 balance = artistBalances[msg.sender];
        require(balance > 0, "No balance to withdraw");

        artistBalances[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "Withdrawal failed");

        emit ArtistWithdrawal(msg.sender, balance);
    }

    function withdrawPlatformBalance() external onlyOwner nonReentrant {
        uint256 balance = platformBalance;
        require(balance > 0, "No balance to withdraw");

        platformBalance = 0;

        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");

        emit PlatformWithdrawal(owner(), balance);
    }

    function claimPendingRefund() external nonReentrant {
        uint256 amount = pendingBuyerRefunds[msg.sender];
        require(amount > 0, "No refund available");

        pendingBuyerRefunds[msg.sender] = 0;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund claim failed");

        emit BuyerRefundClaimed(msg.sender, amount);
    }

    function getArtistBalance(address _artist) external view returns (uint256) {
        return artistBalances[_artist];
    }

    function setPlatformCommission(uint256 _percent) external onlyOwner {
        require(_percent <= 20, "Commission too high");
        platformCommissionPercent = _percent;
    }

    function getProduct(uint256 _productId) external view returns (Product memory) {
        return products[_productId];
    }
}
