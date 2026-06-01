// ========== УПРАВЛЕНИЕ КОРЗИНОЙ ==========

function getCart() {
    const cart = localStorage.getItem('cart');
    return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(productId, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    let cart = getCart();
    const item = cart.find(i => i.productId === productId);
    
    if (item) {
        item.quantity++;
    } else {
        cart.push({ productId: productId, quantity: 1 });
    }
    
    saveCart(cart);
    updateCartCount();
    alert('✅ Товар добавлен в корзину!');
}

function removeFromCart(productId) {
    if (!confirm('Удалить товар из корзины?')) return;
    
    let cart = getCart();
    cart = cart.filter(i => i.productId !== productId);
    saveCart(cart);
    updateCartCount();
    loadCart();
}

function updateCartCount() {
    const cart = getCart();
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const elements = document.querySelectorAll('#cartCount');
    elements.forEach(el => {
        el.textContent = count;
    });
}

function clearCart() {
    localStorage.removeItem('cart');
    updateCartCount();
}

// ========== ПРОВЕРКА АВТОРИЗАЦИИ ==========

async function checkAuth() {
    try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
            const data = await response.json();
            updateUserMenu(data);
        } else {
            updateUserMenu(null);
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        updateUserMenu(null);
    }
}

async function fetchAuthCheck() {
    try {
        const response = await fetch('/api/auth/check');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Ошибка:', error);
    }
    return null;
}

function updateUserMenu(authData) {
    const userMenu = document.getElementById('userMenu');
    if (!userMenu) return;
    
    if (authData && authData.authenticated) {
        const user = authData.user;
        userMenu.innerHTML = `
            <span style="color: white;">Привет, ${user.name || user.email}!</span>
            ${user.is_admin ? '<a href="/admin">⚙️ Админка</a>' : '<a href="/profile">👤 Профиль</a>'}
            <a href="/logout">Выход</a>
        `;
    } else {
        userMenu.innerHTML = '<a href="/login">Вход</a>';
    }
}

// Добавляем API endpoint для проверки авторизации
if (typeof window !== 'undefined') {
    // Создаем фейковый endpoint если его нет в app.py
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        if (url === '/api/auth/check') {
            // Проверяем есть ли сессия через простой запрос
            return originalFetch(url, options).catch(() => {
                return Promise.resolve(new Response(JSON.stringify({authenticated: false}), {
                    status: 200,
                    headers: {'Content-Type': 'application/json'}
                }));
            });
        }
        return originalFetch(url, options);
    };
}

// ========== ГЛАВНАЯ СТРАНИЦА ==========

async function loadBestsellers() {
    try {
        const response = await fetch('/api/products?sort=rating');
        const products = await response.json();
        
        const container = document.getElementById('bestsellers');
        if (!container) return;
        
        container.innerHTML = products.slice(0, 6).map(product => `
            <div class="product-card">
                <a href="/product/${product.id}">
                    <img src="${product.image}" alt="${product.name}">
                </a>
                <h3><a href="/product/${product.id}">${product.name}</a></h3>
                <div class="price">${product.price} сом</div>
                <button onclick="addToCart(${product.id}, event)" class="btn btn-primary">В корзину</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
    }
}

// ========== КАТАЛОГ ==========

let currentFilters = {
    category: null,
    brand: null,
    search: null
};

async function loadCatalog() {
    await loadCategories();
    await loadBrands();
    
    // Проверяем URL параметры
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    if (category) {
        currentFilters.category = category;
    }
    
    loadProducts();
}

async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const container = document.getElementById('categoryFilters');
        if (!container) return;
        
        container.innerHTML = categories.map(cat => `
            <label>
                <input type="radio" name="category" value="${cat}" onchange="filterByCategory('${cat}')" ${currentFilters.category === cat ? 'checked' : ''}>
                ${cat}
            </label>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
    }
}

async function loadBrands() {
    try {
        const response = await fetch('/api/brands');
        const brands = await response.json();
        
        const container = document.getElementById('brandFilters');
        if (!container) return;
        
        container.innerHTML = brands.map(brand => `
            <label>
                <input type="radio" name="brand" value="${brand}" onchange="filterByBrand('${brand}')">
                ${brand}
            </label>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки брендов:', error);
    }
}

function filterByCategory(category) {
    currentFilters.category = category;
    loadProducts();
}

function filterByBrand(brand) {
    currentFilters.brand = brand;
    loadProducts();
}

function resetFilters() {
    currentFilters = {
        category: null,
        brand: null,
        search: null
    };
    
    document.querySelectorAll('input[type="radio"]').forEach(input => {
        input.checked = false;
    });
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) sortSelect.value = 'name';
    
    loadProducts();
}

// Поиск при вводе
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                currentFilters.search = e.target.value;
                loadProducts();
            }, 300);
        });
    }
});

async function loadProducts() {
    try {
        let url = '/api/products?';
        
        if (currentFilters.category) {
            url += `category=${encodeURIComponent(currentFilters.category)}&`;
        }
        if (currentFilters.brand) {
            url += `brand=${encodeURIComponent(currentFilters.brand)}&`;
        }
        if (currentFilters.search) {
            url += `search=${encodeURIComponent(currentFilters.search)}&`;
        }
        
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            url += `sort=${sortSelect.value}`;
        }
        
        const response = await fetch(url);
        const products = await response.json();
        
        const grid = document.getElementById('productsGrid');
        const emptyResults = document.getElementById('emptyResults');
        
        if (!grid) return;
        
        if (products.length === 0) {
            grid.style.display = 'none';
            if (emptyResults) emptyResults.style.display = 'block';
        } else {
            grid.style.display = 'grid';
            if (emptyResults) emptyResults.style.display = 'none';
            
            grid.innerHTML = products.map(product => `
                <div class="product-card">
                    <a href="/product/${product.id}">
                        <img src="${product.image}" alt="${product.name}">
                    </a>
                    <h3><a href="/product/${product.id}">${product.name}</a></h3>
                    <div class="price">${product.price} сом</div>
                    <button onclick="addToCart(${product.id}, event)" class="btn btn-primary">В корзину</button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
    }
}

// ========== СТРАНИЦА ТОВАРА ==========

async function loadProductPage() {
    const productId = window.location.pathname.split('/').pop();
    
    try {
        const response = await fetch(`/api/products/${productId}`);
        const product = await response.json();
        
        const container = document.getElementById('productDetails');
        if (!container) return;
        
        container.innerHTML = `
            <div>
                <img src="${product.image}" alt="${product.name}">
            </div>
            <div>
                <h1>${product.name}</h1>
                <p>${product.description || 'Описание отсутствует'}</p>
                
                <div class="price">${product.price} сом</div>
                
                <div class="product-info">
                    <p><strong>Категория:</strong> ${product.category}</p>
                    <p><strong>Бренд:</strong> ${product.brand || '-'}</p>
                    <p><strong>В наличии:</strong> ${product.stock} шт.</p>
                    <p><strong>Рейтинг:</strong> ${'⭐'.repeat(Math.floor(product.rating))} ${product.rating.toFixed(1)}</p>
                </div>
                
                <br>
                <button onclick="addToCart(${product.id}, event)" class="btn btn-primary btn-large" ${product.stock === 0 ? 'disabled' : ''}>
                    ${product.stock === 0 ? 'Нет в наличии' : 'Добавить в корзину'}
                </button>
                <br><br>
                <a href="/catalog" class="btn btn-secondary">← Вернуться в каталог</a>
            </div>
        `;
    } catch (error) {
        console.error('Ошибка загрузки товара:', error);
        const container = document.getElementById('productDetails');
        if (container) {
            container.innerHTML = '<p>Ошибка загрузки товара</p>';
        }
    }
}

// ========== КОРЗИНА ==========

async function loadCart() {
    const cart = getCart();
    const cartItems = document.getElementById('cartItems');
    const emptyCart = document.getElementById('emptyCart');
    const cartSummary = document.getElementById('cartSummary');
    
    if (!cartItems) return;
    
    if (cart.length === 0) {
        cartItems.style.display = 'none';
        if (emptyCart) emptyCart.style.display = 'block';
        if (cartSummary) cartSummary.style.display = 'none';
        return;
    }
    
    cartItems.style.display = 'block';
    if (emptyCart) emptyCart.style.display = 'none';
    if (cartSummary) cartSummary.style.display = 'block';
    
    let total = 0;
    let html = '';
    
    for (const item of cart) {
        try {
            const response = await fetch(`/api/products/${item.productId}`);
            const product = await response.json();
            const itemTotal = product.price * item.quantity;
            total += itemTotal;
            
            html += `
                <div class="cart-item">
                    <img src="${product.image}" alt="${product.name}">
                    <div>
                        <h3>${product.name}</h3>
                        <p>Цена: ${product.price} сом</p>
                        <p>Количество: ${item.quantity}</p>
                        <p><strong>Итого: ${itemTotal} сом</strong></p>
                    </div>
                    <div>
                        <button onclick="removeFromCart(${product.id})" class="btn btn-secondary">Удалить</button>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Ошибка загрузки товара:', error);
        }
    }
    
    cartItems.innerHTML = html;
    const cartTotal = document.getElementById('cartTotal');
    if (cartTotal) cartTotal.textContent = total;
}

async function showCheckoutForm() {
    // Проверяем авторизацию
    const authData = await fetchAuthCheck();
    
    const checkoutForm = document.getElementById('checkoutForm');
    const cartSummary = document.getElementById('cartSummary');
    const loginWarning = document.getElementById('loginWarning');
    
    if (!authData || !authData.authenticated) {
        if (loginWarning) loginWarning.style.display = 'block';
    } else {
        if (loginWarning) loginWarning.style.display = 'none';
    }
    
    if (checkoutForm) checkoutForm.style.display = 'block';
    if (cartSummary) cartSummary.style.display = 'none';
}

function hideCheckoutForm() {
    const checkoutForm = document.getElementById('checkoutForm');
    const cartSummary = document.getElementById('cartSummary');
    
    if (checkoutForm) checkoutForm.style.display = 'none';
    if (cartSummary) cartSummary.style.display = 'block';
}

async function submitOrder() {
    const phone = document.getElementById('orderPhone').value;
    const address = document.getElementById('orderAddress').value;
    
    if (!phone || !address) {
        alert('⚠️ Заполните все обязательные поля!');
        return;
    }
    
    const cart = getCart();
    if (cart.length === 0) {
        alert('⚠️ Корзина пуста!');
        return;
    }
    
    let total = 0;
    const items = [];
    
    for (const item of cart) {
        try {
            const response = await fetch(`/api/products/${item.productId}`);
            const product = await response.json();
            total += product.price * item.quantity;
            items.push({
                product_id: item.productId,
                quantity: item.quantity,
                price: product.price
            });
        } catch (error) {
            console.error('Ошибка получения товара:', error);
            alert('❌ Ошибка при подготовке заказа');
            return;
        }
    }
    
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                total: total,
                phone: phone,
                address: address,
                items: items
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`✅ Заказ №${result.order_id} успешно оформлен!\n\nСумма: ${total} сом\n\nМы свяжемся с вами в ближайшее время по телефону ${phone}`);
            clearCart();
            window.location.href = '/';
        } else if (response.status === 401) {
            alert('⚠️ Для оформления заказа необходимо войти в систему');
            window.location.href = '/login';
        } else {
            alert('❌ Ошибка при оформлении заказа');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при оформлении заказа');
    }
}

// ========== АВТОРИЗАЦИЯ ==========

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    if (!email || !password) {
        errorMessage.textContent = '⚠️ Заполните все поля!';
        errorMessage.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.is_admin) {
                window.location.href = '/admin';
            } else {
                window.location.href = '/';
            }
        } else {
            const data = await response.json();
            errorMessage.textContent = '❌ ' + (data.error || 'Ошибка входа');
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        errorMessage.textContent = '❌ Ошибка подключения к серверу';
        errorMessage.style.display = 'block';
    }
}

async function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    if (errorMessage) errorMessage.style.display = 'none';
    if (successMessage) successMessage.style.display = 'none';
    
    if (!email || !password || !name) {
        errorMessage.textContent = '⚠️ Заполните обязательные поля!';
        errorMessage.style.display = 'block';
        return;
    }
    
    if (password.length < 6) {
        errorMessage.textContent = '⚠️ Пароль должен быть не менее 6 символов!';
        errorMessage.style.display = 'block';
        return;
    }
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, name, phone })
        });
        
        if (response.ok) {
            successMessage.textContent = '✅ Регистрация успешна! Перенаправление на страницу входа...';
            successMessage.style.display = 'block';
            
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            const data = await response.json();
            errorMessage.textContent = '❌ ' + (data.error || 'Ошибка регистрации');
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        errorMessage.textContent = '❌ Ошибка подключения к серверу';
        errorMessage.style.display = 'block';
    }
}

// ========== ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ==========

async function loadMyOrders() {
    try {
        const response = await fetch('/api/my-orders');
        
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login';
                return;
            }
            throw new Error('Ошибка загрузки заказов');
        }
        
        const orders = await response.json();
        const container = document.getElementById('myOrders');
        const noOrders = document.getElementById('noOrders');
        
        if (!container) return;
        
        if (orders.length === 0) {
            container.style.display = 'none';
            if (noOrders) noOrders.style.display = 'block';
            return;
        }
        
        container.style.display = 'block';
        if (noOrders) noOrders.style.display = 'none';
        
        container.innerHTML = orders.map(order => {
            const date = new Date(order.date);
            const statusClass = order.status === 'completed' ? 'status-completed' : 
                              order.status === 'processing' ? 'status-processing' : 'status-pending';
            const statusText = order.status === 'completed' ? 'Выполнен' :
                             order.status === 'processing' ? 'В обработке' : 'Ожидает обработки';
            
            return `
                <div class="order-card">
                    <div class="order-header">
                        <div>
                            <h3>Заказ №${order.id}</h3>
                            <p>${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</p>
                        </div>
                        <span class="order-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="order-items">
                        ${order.items.map(item => `
                            <p>• ${item.product_name} - ${item.quantity} шт. × ${item.price} сом</p>
                        `).join('')}
                    </div>
                    <div class="order-total">
                        <strong>Итого: ${order.total} сом</strong>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
}

// ========== АДМИН-ПАНЕЛЬ ==========

async function loadAdminStats() {
    try {
        const response = await fetch('/api/admin/stats');
        const data = await response.json();
        
        document.getElementById('totalProducts').textContent = data.total_products;
        document.getElementById('totalOrders').textContent = data.total_orders;
        document.getElementById('totalUsers').textContent = data.total_users;
        document.getElementById('totalRevenue').textContent = Math.round(data.total_revenue) + ' сом';
        
        // Последние заказы
        const tbody = document.querySelector('#recentOrdersTable tbody');
        if (tbody && data.recent_orders) {
            tbody.innerHTML = data.recent_orders.map(o => {
                const date = new Date(o.date);
                const statusClass = o.status === 'completed' ? 'status-completed' : 
                                  o.status === 'processing' ? 'status-processing' : 'status-pending';
                const statusText = o.status === 'completed' ? 'Выполнен' :
                                 o.status === 'processing' ? 'В обработке' : 'Ожидает';
                
                return `
                    <tr>
                        <td>#${o.id}</td>
                        <td>${Math.round(o.total)} сом</td>
                        <td><span class="order-status ${statusClass}">${statusText}</span></td>
                        <td>${date.toLocaleDateString('ru-RU')}</td>
                    </tr>
                `;
            }).join('');
        }
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function loadAdminProducts() {
    try {
        const response = await fetch('/api/products');
        const products = await response.json();
        
        const tbody = document.querySelector('#productsTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = products.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><img src="${p.image}" alt="${p.name}"></td>
                <td>${p.name}</td>
                <td>${p.price} сом</td>
                <td>${p.category}</td>
                <td>${p.stock}</td>
                <td>
                    <button onclick="editProduct(${p.id})" class="btn btn-primary">✏️ Изменить</button>
                    <button onclick="deleteProduct(${p.id})" class="btn btn-secondary">🗑️ Удалить</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
    }
}

function showAddProductModal() {
    document.getElementById('modalTitle').textContent = 'Добавить товар';
    document.getElementById('editProductId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productBrand').value = '';
    document.getElementById('productImage').value = '';
    document.getElementById('productRating').value = '0';
    
    document.getElementById('productModal').style.display = 'flex';
}

async function editProduct(id) {
    try {
        const response = await fetch(`/api/products/${id}`);
        const product = await response.json();
        
        document.getElementById('modalTitle').textContent = 'Редактировать товар';
        document.getElementById('editProductId').value = product.id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productDescription').value = product.description || '';
        document.getElementById('productPrice').value = product.price;
        document.getElementById('productStock').value = product.stock;
        document.getElementById('productCategory').value = product.category;
        document.getElementById('productBrand').value = product.brand || '';
        document.getElementById('productImage').value = product.image || '';
        document.getElementById('productRating').value = product.rating || 0;
        
        document.getElementById('productModal').style.display = 'flex';
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка загрузки товара');
    }
}

async function saveProduct() {
    const id = document.getElementById('editProductId').value;
    const data = {
        name: document.getElementById('productName').value,
        description: document.getElementById('productDescription').value,
        price: parseFloat(document.getElementById('productPrice').value),
        stock: parseInt(document.getElementById('productStock').value),
        category: document.getElementById('productCategory').value,
        brand: document.getElementById('productBrand').value,
        image: document.getElementById('productImage').value || 'https://via.placeholder.com/300',
        rating: parseFloat(document.getElementById('productRating').value) || 0
    };
    
    if (!data.name || !data.price || !data.category) {
        alert('⚠️ Заполните обязательные поля!');
        return;
    }
    
    try {
        let response;
        if (id) {
            response = await fetch(`/api/admin/products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            response = await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
        
        if (response.ok) {
            alert('✅ Товар успешно сохранен!');
            closeModal();
            loadAdminProducts();
        } else {
            alert('❌ Ошибка при сохранении товара');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при сохранении товара');
    }
}

async function deleteProduct(id) {
    if (!confirm('⚠️ Вы уверены, что хотите удалить этот товар?')) return;
    
    try {
        const response = await fetch(`/api/admin/products/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('✅ Товар успешно удален');
            loadAdminProducts();
        } else {
            alert('❌ Ошибка при удалении товара');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при удалении товара');
    }
}

function closeModal() {
    document.getElementById('productModal').style.display = 'none';
}

async function loadAdminOrders() {
    try {
        const response = await fetch('/api/admin/orders');
        const orders = await response.json();
        
        const tbody = document.querySelector('#ordersTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = orders.map(o => {
            const date = new Date(o.date);
            return `
                <tr>
                    <td><strong>#${o.id}</strong></td>
                    <td>${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}</td>
                    <td><strong>${Math.round(o.total)} сом</strong></td>
                    <td>${o.phone}</td>
                    <td>${o.address.substring(0, 30)}...</td>
                    <td>
                        <select onchange="updateOrderStatus(${o.id}, this.value)">
                            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>Ожидает</option>
                            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>В обработке</option>
                            <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>Выполнен</option>
                        </select>
                    </td>
                    <td>
                        <button onclick="viewOrderDetails(${o.id})" class="btn btn-primary">👁️ Детали</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
    }
}

async function updateOrderStatus(id, status) {
    try {
        const response = await fetch(`/api/admin/orders/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            alert('✅ Статус заказа обновлен');
            loadAdminOrders();
        } else {
            alert('❌ Ошибка при обновлении статуса');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при обновлении статуса');
    }
}

async function viewOrderDetails(id) {
    try {
        const response = await fetch('/api/admin/orders');
        const orders = await response.json();
        const order = orders.find(o => o.id === id);
        
        if (!order) return;
        
        const date = new Date(order.date);
        
        document.getElementById('orderNumber').textContent = order.id;
        document.getElementById('orderDetails').innerHTML = `
            <p><strong>Дата:</strong> ${date.toLocaleString('ru-RU')}</p>
            <p><strong>Телефон:</strong> ${order.phone}</p>
            <p><strong>Адрес доставки:</strong> ${order.address}</p>
            <p><strong>Статус:</strong> ${order.status === 'completed' ? 'Выполнен' : order.status === 'processing' ? 'В обработке' : 'Ожидает'}</p>
            <br>
            <h3>Состав заказа:</h3>
            <table style="width: 100%; margin-top: 15px;">
                <thead>
                    <tr>
                        <th>Товар</th>
                        <th>Количество</th>
                        <th>Цена</th>
                        <th>Сумма</th>
                    </tr>
                </thead>
                <tbody>
                    ${order.items.map(item => `
                        <tr>
                            <td>${item.product_name}</td>
                            <td>${item.quantity}</td>
                            <td>${item.price} сом</td>
                            <td><strong>${item.price * item.quantity} сом</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="text-align: right;"><strong>ИТОГО:</strong></td>
                        <td><strong>${Math.round(order.total)} сом</strong></td>
                    </tr>
                </tfoot>
            </table>
        `;
        
        document.getElementById('orderModal').style.display = 'flex';
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
}

async function loadAdminUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const users = await response.json();
        
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = users.map(u => {
            const date = new Date(u.created_at);
            return `
                <tr>
                    <td>${u.id}</td>
                    <td>${u.email}</td>
                    <td>${u.name || '-'}</td>
                    <td>${u.phone || '-'}</td>
                    <td>${u.is_admin ? '👑 Администратор' : '👤 Пользователь'}</td>
                    <td>${date.toLocaleDateString('ru-RU')}</td>
                    <td>
                        <button onclick="toggleAdmin(${u.id})" class="btn ${u.is_admin ? 'btn-secondary' : 'btn-primary'}">
                            ${u.is_admin ? '❌ Убрать админа' : '✅ Сделать админом'}
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
    }
}

async function toggleAdmin(id) {
    if (!confirm('⚠️ Изменить права администратора для этого пользователя?')) return;
    
    try {
        const response = await fetch(`/api/admin/users/${id}/admin`, {
            method: 'PUT'
        });
        
        if (response.ok) {
            alert('✅ Права пользователя изменены');
            loadAdminUsers();
        } else {
            alert('❌ Ошибка при изменении прав');
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Ошибка при изменении прав');
    }
}

// ========== ОБРАБОТКА ENTER В ФОРМАХ ==========

document.addEventListener('DOMContentLoaded', () => {
    // Enter для логина
    const passwordField = document.getElementById('password');
    if (passwordField && window.location.pathname === '/login') {
        passwordField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
    
    // Enter для регистрации
    if (passwordField && window.location.pathname === '/register') {
        passwordField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                register();
            }
        });
    }
});