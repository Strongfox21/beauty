from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__)
app.secret_key = 'beauty-shop-secret-key-2024'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ============== МОДЕЛИ ==============

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(100))
    brand = db.Column(db.String(100))
    image = db.Column(db.String(500))
    stock = db.Column(db.Integer, default=0)
    rating = db.Column(db.Float, default=0.0)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    total = db.Column(db.Float)
    status = db.Column(db.String(50), default='pending')
    address = db.Column(db.Text)
    phone = db.Column(db.String(20))
    date = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship('OrderItem', backref='order', lazy=True)

class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'))
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'))
    quantity = db.Column(db.Integer)
    price = db.Column(db.Float)
    product = db.relationship('Product')

# ============== ДЕКОРАТОРЫ ==============

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect('/login')
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect('/login')
        user = User.query.get(session['user_id'])
        if not user or not user.is_admin:
            return 'Доступ запрещен. Требуются права администратора.', 403
        return f(*args, **kwargs)
    return decorated

# ============== СТРАНИЦЫ ==============

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/catalog')
def catalog():
    return render_template('catalog.html')

@app.route('/product/<int:id>')
def product(id):
    return render_template('product.html')

@app.route('/cart')
def cart():
    return render_template('cart.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return render_template('login.html')
    
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    
    if user and check_password_hash(user.password, data['password']):
        session['user_id'] = user.id
        session['is_admin'] = user.is_admin
        session['user_name'] = user.name
        return jsonify({'success': True, 'is_admin': user.is_admin, 'name': user.name})
    
    return jsonify({'error': 'Неверный email или пароль'}), 401

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'GET':
        return render_template('register.html')
    
    data = request.json
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email уже зарегистрирован'}), 400
    
    user = User(
        email=data['email'],
        password=generate_password_hash(data['password']),
        name=data.get('name', ''),
        phone=data.get('phone', ''),
        is_admin=False
    )
    db.session.add(user)
    db.session.commit()
    
    return jsonify({'success': True})

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/profile')
@login_required
def profile():
    return render_template('profile.html')

@app.route('/admin')
@admin_required
def admin():
    return render_template('admin/dashboard.html')

@app.route('/admin/products')
@admin_required
def admin_products():
    return render_template('admin/products.html')

@app.route('/admin/orders')
@admin_required
def admin_orders():
    return render_template('admin/orders.html')

@app.route('/admin/users')
@admin_required
def admin_users():
    return render_template('admin/users.html')

# ============== API ==============

@app.route('/api/products')
def get_products():
    products = Product.query.all()
    
    category = request.args.get('category')
    brand = request.args.get('brand')
    search = request.args.get('search')
    sort = request.args.get('sort')
    
    if category:
        products = [p for p in products if p.category == category]
    if brand:
        products = [p for p in products if p.brand == brand]
    if search:
        products = [p for p in products if search.lower() in p.name.lower()]
    
    if sort == 'price_asc':
        products.sort(key=lambda x: x.price)
    elif sort == 'price_desc':
        products.sort(key=lambda x: x.price, reverse=True)
    elif sort == 'rating':
        products.sort(key=lambda x: x.rating, reverse=True)
    
    return jsonify([{
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'price': p.price,
        'category': p.category,
        'brand': p.brand,
        'image': p.image,
        'stock': p.stock,
        'rating': p.rating
    } for p in products])

@app.route('/api/products/<int:id>')
def get_product(id):
    p = Product.query.get_or_404(id)
    return jsonify({
        'id': p.id,
        'name': p.name,
        'description': p.description,
        'price': p.price,
        'category': p.category,
        'brand': p.brand,
        'image': p.image,
        'stock': p.stock,
        'rating': p.rating
    })

@app.route('/api/categories')
def get_categories():
    categories = db.session.query(Product.category).distinct().all()
    return jsonify([c[0] for c in categories if c[0]])

@app.route('/api/brands')
def get_brands():
    brands = db.session.query(Product.brand).distinct().all()
    return jsonify([b[0] for b in brands if b[0]])

@app.route('/api/orders', methods=['POST'])
@login_required
def create_order():
    data = request.json
    
    order = Order(
        user_id=session['user_id'],
        total=data['total'],
        address=data['address'],
        phone=data['phone']
    )
    db.session.add(order)
    db.session.flush()
    
    for item in data['items']:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item['product_id'],
            quantity=item['quantity'],
            price=item['price']
        )
        db.session.add(order_item)
    
    db.session.commit()
    return jsonify({'success': True, 'order_id': order.id})

@app.route('/api/my-orders')
@login_required
def get_my_orders():
    orders = Order.query.filter_by(user_id=session['user_id']).order_by(Order.date.desc()).all()
    return jsonify([{
        'id': o.id,
        'total': o.total,
        'status': o.status,
        'date': o.date.isoformat(),
        'items': [{
            'product_name': i.product.name,
            'quantity': i.quantity,
            'price': i.price
        } for i in o.items]
    } for o in orders])

@app.route('/api/auth/check')
def check_auth_status():
    if 'user_id' in session:
        user = User.query.get(session['user_id'])
        if user:
            return jsonify({
                'authenticated': True,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.name,
                    'phone': user.phone,
                    'is_admin': user.is_admin
                }
            })
    return jsonify({'authenticated': False})

# ============== АДМИН API ==============

@app.route('/api/admin/stats')
@admin_required
def admin_stats():
    total_products = Product.query.count()
    total_orders = Order.query.count()
    total_users = User.query.count()
    total_revenue = db.session.query(db.func.sum(Order.total)).scalar() or 0
    
    recent_orders = Order.query.order_by(Order.date.desc()).limit(5).all()
    
    return jsonify({
        'total_products': total_products,
        'total_orders': total_orders,
        'total_users': total_users,
        'total_revenue': total_revenue,
        'recent_orders': [{
            'id': o.id,
            'total': o.total,
            'status': o.status,
            'date': o.date.isoformat()
        } for o in recent_orders]
    })

@app.route('/api/admin/products', methods=['POST'])
@admin_required
def add_product():
    data = request.json
    product = Product(
        name=data['name'],
        description=data.get('description'),
        price=data['price'],
        category=data['category'],
        brand=data.get('brand'),
        image=data.get('image'),
        stock=data.get('stock', 0),
        rating=data.get('rating', 0)
    )
    db.session.add(product)
    db.session.commit()
    return jsonify({'success': True, 'id': product.id})

@app.route('/api/admin/products/<int:id>', methods=['PUT'])
@admin_required
def update_product(id):
    product = Product.query.get_or_404(id)
    data = request.json
    
    product.name = data.get('name', product.name)
    product.description = data.get('description', product.description)
    product.price = data.get('price', product.price)
    product.category = data.get('category', product.category)
    product.brand = data.get('brand', product.brand)
    product.image = data.get('image', product.image)
    product.stock = data.get('stock', product.stock)
    product.rating = data.get('rating', product.rating)
    
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/products/<int:id>', methods=['DELETE'])
@admin_required
def delete_product(id):
    product = Product.query.get_or_404(id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/orders')
@admin_required
def get_all_orders():
    orders = Order.query.order_by(Order.date.desc()).all()
    return jsonify([{
        'id': o.id,
        'user_id': o.user_id,
        'total': o.total,
        'status': o.status,
        'address': o.address,
        'phone': o.phone,
        'date': o.date.isoformat(),
        'items': [{
            'product_name': i.product.name,
            'quantity': i.quantity,
            'price': i.price
        } for i in o.items]
    } for o in orders])

@app.route('/api/admin/orders/<int:id>/status', methods=['PUT'])
@admin_required
def update_order_status(id):
    order = Order.query.get_or_404(id)
    order.status = request.json['status']
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/admin/users')
@admin_required
def get_all_users():
    users = User.query.all()
    return jsonify([{
        'id': u.id,
        'email': u.email,
        'name': u.name,
        'phone': u.phone,
        'is_admin': u.is_admin,
        'created_at': u.created_at.isoformat()
    } for u in users])

@app.route('/api/admin/users/<int:id>/admin', methods=['PUT'])
@admin_required
def toggle_admin(id):
    user = User.query.get_or_404(id)
    user.is_admin = not user.is_admin
    db.session.commit()
    return jsonify({'success': True})

# ============== ИНИЦИАЛИЗАЦИЯ ==============

def init_db():
    with app.app_context():
        db.create_all()
        
        # Создать админа
        if not User.query.filter_by(email='admin@beautyshop.kg').first():
            admin = User(
                email='admin@beautyshop.kg',
                password=generate_password_hash('admin123'),
                name='Администратор',
                phone='+996 555 123 456',
                is_admin=True
            )
            db.session.add(admin)
            print('✅ Админ создан: admin@beautyshop.kg / admin123')
        
        # Создать тестового пользователя
        if not User.query.filter_by(email='user@test.kg').first():
            user = User(
                email='user@test.kg',
                password=generate_password_hash('user123'),
                name='Тестовый Пользователь',
                phone='+996 555 999 888',
                is_admin=False
            )
            db.session.add(user)
            print('✅ Пользователь создан: user@test.kg / user123')
        
        # Добавить товары
        if Product.query.count() == 0:
            products = [
                # Макияж
                Product(name='Тушь для ресниц Volume Express', description='Объемная тушь для ресниц с эффектом накладных ресниц. Придает объем и длину.', price=450, category='Макияж', brand='Maybelline', image='https://images.pexels.com/photos/2113855/pexels-photo-2113855.jpeg', stock=50, rating=4.5),
                Product(name='Помада матовая Superstay', description='Стойкая матовая помада держится до 16 часов. Не сушит губы.', price=650, category='Макияж', brand='Maybelline', image='https://images.pexels.com/photos/3373736/pexels-photo-3373736.jpeg', stock=30, rating=4.7),
                Product(name='Тональный крем Infaillible', description='Стойкий тональный крем с SPF защитой. Идеальное покрытие.', price=980, category='Макияж', brand="L'Oréal", image='https://images.pexels.com/photos/3762879/pexels-photo-3762879.jpeg', stock=40, rating=4.6),
                
                # Уход за лицом
                Product(name='Гиалуроновая кислота сыворотка', description='Интенсивное увлажнение кожи. Подходит для всех типов кожи.', price=1200, category='Уход за лицом', brand='The Ordinary', image='https://images.pexels.com/photos/3685530/pexels-photo-3685530.jpeg', stock=25, rating=4.8),
                Product(name='Крем для лица Hydra Genius', description='Увлажняющий крем с алоэ вера. Легкая текстура.', price=680, category='Уход за лицом', brand="L'Oréal", image='https://images.pexels.com/photos/3018845/pexels-photo-3018845.jpeg', stock=35, rating=4.4),
                Product(name='Мицеллярная вода Sensibio', description='Нежное очищение чувствительной кожи. Без парабенов.', price=850, category='Уход за лицом', brand='Bioderma', image='https://images.pexels.com/photos/3762882/pexels-photo-3762882.jpeg', stock=60, rating=4.9),
                
                # Уход за волосами
                Product(name='Шампунь восстанавливающий', description='Для поврежденных и сухих волос. С кератином.', price=280, category='Уход за волосами', brand="L'Oréal", image='https://images.pexels.com/photos/4465124/pexels-photo-4465124.jpeg', stock=70, rating=4.3),
                Product(name='Маска для волос питательная', description='Питательная маска с натуральными маслами. Восстановление за 3 минуты.', price=480, category='Уход за волосами', brand="L'Oréal", image='https://images.pexels.com/photos/3785147/pexels-photo-3785147.jpeg', stock=45, rating=4.5),
                
                # Уход за телом
                Product(name='Лосьон для тела с маслом ши', description='Глубокое увлажнение на 48 часов. Приятный аромат.', price=520, category='Уход за телом', brand='Garnier', image='https://images.pexels.com/photos/3685499/pexels-photo-3685499.jpeg', stock=55, rating=4.6),
                Product(name='Скраб для тела сахарный', description='Нежное отшелушивание и увлажнение. С экстрактом кокоса.', price=380, category='Уход за телом', brand='Garnier', image='https://images.pexels.com/photos/4202325/pexels-photo-4202325.jpeg', stock=40, rating=4.4),
                
                # Парфюмерия
                Product(name='Туалетная вода Bloom', description='Свежий цветочный аромат. Стойкость до 6 часов.', price=3200, category='Парфюмерия', brand='Gucci', image='https://images.pexels.com/photos/1961795/pexels-photo-1961795.jpeg', stock=15, rating=4.9),
                Product(name='Парфюм Coco Mademoiselle', description='Элегантный восточный аромат. Люксовая парфюмерия.', price=4800, category='Парфюмерия', brand='Chanel', image='https://images.pexels.com/photos/3373736/pexels-photo-3373736.jpeg', stock=10, rating=5.0),
            ]
            
            for p in products:
                db.session.add(p)
            
            db.session.commit()
            print('✅ Товары добавлены: 12 шт. (цены в сомах)')

if __name__ == '__main__':
    init_db()
    print('\n' + '='*50)
    print('🚀 BeautyShop запущен!')
    print('='*50)
    print('📍 Адрес: http://localhost:5000')
    print('\n👑 АДМИН:')
    print('   Email: admin@beautyshop.kg')
    print('   Пароль: admin123')
    print('\n👤 ПОЛЬЗОВАТЕЛЬ:')
    print('   Email: user@test.kg')
    print('   Пароль: user123')
    print('='*50 + '\n')
    app.run(debug=True, port=5000)