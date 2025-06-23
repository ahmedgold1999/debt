import { initAuth, signUp, signIn, logout, getCurrentUser } from './auth.js';
import { customerService, transactionService, statsService, realtimeService } from './database.js';
import { formatCurrency, TRANSACTION_TYPES } from './firebase.js';

// Global state
let currentCustomers = [];
let currentStats = {};
let customersListener = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize authentication
        await initAuth();
        
        // Setup event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('App initialization error:', error);
        showAlert('حدث خطأ في تحميل التطبيق', 'error');
    }
});

// Setup event listeners
const setupEventListeners = () => {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Signup form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    // Add customer form
    const addCustomerForm = document.getElementById('add-customer-form');
    if (addCustomerForm) {
        addCustomerForm.addEventListener('submit', handleAddCustomer);
    }
    
    // Customer search
    const customerSearch = document.getElementById('customer-search');
    if (customerSearch) {
        customerSearch.addEventListener('input', handleCustomerSearch);
    }
    
    // Modal overlay click
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }
};

// Handle login
const handleLogin = async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showAlert('يرجى إدخال جميع البيانات المطلوبة', 'warning');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري تسجيل الدخول...';
        
        await signIn(email, password);
        
    } catch (error) {
        console.error('Login error:', error);
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
    }
};

// Handle signup
const handleSignup = async (e) => {
    e.preventDefault();
    
    const formData = {
        storeName: document.getElementById('store-name').value,
        ownerName: document.getElementById('owner-name').value,
        email: document.getElementById('signup-email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        password: document.getElementById('signup-password').value,
        confirmPassword: document.getElementById('confirm-password').value
    };
    
    // Validation
    if (!formData.storeName || !formData.ownerName || !formData.email || 
        !formData.phone || !formData.password) {
        showAlert('يرجى إدخال جميع البيانات المطلوبة', 'warning');
        return;
    }
    
    if (formData.password !== formData.confirmPassword) {
        showAlert('كلمة المرور وتأكيد كلمة المرور غير متطابقتين', 'error');
        return;
    }
    
    if (formData.password.length < 6) {
        showAlert('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }
    
    // Phone validation
    if (!/^05\d{8}$/.test(formData.phone)) {
        showAlert('رقم الهاتف يجب أن يبدأ بـ 05 ويتكون من 10 أرقام', 'error');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري إنشاء الحساب...';
        
        await signUp(formData);
        
    } catch (error) {
        console.error('Signup error:', error);
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء الحساب';
    }
};

// Handle add customer
const handleAddCustomer = async (e) => {
    e.preventDefault();
    
    const customerData = {
        name: document.getElementById('customer-name').value,
        phone: document.getElementById('customer-phone').value,
        address: document.getElementById('customer-address').value,
        notes: document.getElementById('customer-notes').value
    };
    
    // Validation
    if (!customerData.name || !customerData.phone) {
        showAlert('يرجى إدخال اسم العميل ورقم الهاتف', 'warning');
        return;
    }
    
    // Phone validation
    if (!/^05\d{8}$/.test(customerData.phone)) {
        showAlert('رقم الهاتف يجب أن يبدأ بـ 05 ويتكون من 10 أرقام', 'error');
        return;
    }
    
    // Check if phone already exists
    const existingCustomer = currentCustomers.find(c => c.phone === customerData.phone);
    if (existingCustomer) {
        showAlert('رقم الهاتف مسجل بالفعل لعميل آخر', 'error');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';
        
        await customerService.addCustomer(customerData);
        
        showAlert('تم إضافة العميل بنجاح', 'success');
        closeModal();
        e.target.reset();
        
    } catch (error) {
        console.error('Add customer error:', error);
        showAlert('حدث خطأ في إضافة العميل', 'error');
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> إضافة العميل';
    }
};

// Handle customer search
const handleCustomerSearch = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredCustomers = currentCustomers.filter(customer => 
        customer.name.toLowerCase().includes(searchTerm) ||
        customer.phone.includes(searchTerm)
    );
    renderCustomers(filteredCustomers);
};

// Load dashboard data
window.loadDashboardData = async () => {
    try {
        // Load statistics
        currentStats = await statsService.getStoreStats();
        updateStatsDisplay();
        
        // Setup real-time listeners
        setupRealtimeListeners();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showAlert('حدث خطأ في تحميل البيانات', 'error');
    }
};

// Setup real-time listeners
const setupRealtimeListeners = () => {
    const user = getCurrentUser();
    if (!user) return;
    
    // Listen to customers changes
    if (customersListener) {
        customersListener();
    }
    
    customersListener = realtimeService.listenToCustomers(user.uid, (customers) => {
        currentCustomers = customers;
        renderCustomers(customers);
        updateTopDebtors(customers);
        
        // Update stats
        statsService.getStoreStats().then(stats => {
            currentStats = stats;
            updateStatsDisplay();
        });
    });
};

// Update statistics display
const updateStatsDisplay = () => {
    const elements = {
        'total-customers': currentStats.totalCustomers || 0,
        'debtors-count': currentStats.customersWithDebt || 0,
        'total-debt': formatCurrency(currentStats.totalDebt || 0),
        'total-payments': formatCurrency(currentStats.totalPayments || 0)
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
};

// Update top debtors display
const updateTopDebtors = (customers) => {
    const topDebtorsEl = document.getElementById('top-debtors');
    if (!topDebtorsEl) return;
    
    const debtors = customers
        .filter(c => c.totalDebt > 0)
        .sort((a, b) => b.totalDebt - a.totalDebt)
        .slice(0, 5);
    
    if (debtors.length === 0) {
        topDebtorsEl.innerHTML = '<p class="no-data">لا يوجد عملاء مدينون</p>';
        return;
    }
    
    const debtorsHTML = debtors.map(customer => `
        <div class="debtor-item">
            <div class="debtor-info">
                <div class="debtor-avatar">
                    ${customer.name.charAt(0)}
                </div>
                <div class="debtor-details">
                    <h4>${customer.name}</h4>
                    <p>${customer.phone}</p>
                </div>
            </div>
            <div class="debt-amount">
                ${formatCurrency(customer.totalDebt)}
            </div>
        </div>
    `).join('');
    
    topDebtorsEl.innerHTML = debtorsHTML;
};

// Render customers
const renderCustomers = (customers = currentCustomers) => {
    const customersGrid = document.getElementById('customers-grid');
    if (!customersGrid) return;
    
    if (customers.length === 0) {
        customersGrid.innerHTML = '<p class="no-data">لا يوجد عملاء مسجلون</p>';
        return;
    }
    
    const customersHTML = customers.map(customer => `
        <div class="customer-card">
            <div class="customer-header">
                <div class="customer-avatar">
                    ${customer.name.charAt(0)}
                </div>
                <div class="customer-info">
                    <h3>${customer.name}</h3>
                    <p>${customer.phone}</p>
                </div>
            </div>
            
            <div class="customer-details">
                ${customer.address ? `
                    <div class="customer-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${customer.address}</span>
                    </div>
                ` : ''}
                ${customer.notes ? `
                    <div class="customer-detail">
                        <i class="fas fa-sticky-note"></i>
                        <span>${customer.notes}</span>
                    </div>
                ` : ''}
            </div>
            
            <div class="customer-debt">
                <div class="debt-label">الرصيد الحالي</div>
                <div class="debt-value ${customer.totalDebt > 0 ? 'positive' : 'zero'}">
                    ${customer.totalDebt > 0 ? formatCurrency(customer.totalDebt) : 'لا يوجد ديون'}
                </div>
            </div>
            
            <div class="customer-actions">
                <button class="btn btn-primary btn-sm" onclick="showCustomerDetails('${customer.id}')">
                    <i class="fas fa-eye"></i>
                    التفاصيل
                </button>
                <button class="btn btn-outline btn-sm" onclick="editCustomer('${customer.id}')">
                    <i class="fas fa-edit"></i>
                    تعديل
                </button>
            </div>
        </div>
    `).join('');
    
    customersGrid.innerHTML = customersHTML;
};

// Navigation functions
window.showPage = (pageId) => {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`[onclick="showPage('${pageId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Update page title
    const titles = {
        'home': 'لوحة التحكم',
        'customers': 'إدارة العملاء',
        'transactions': 'المعاملات',
        'reports': 'التقارير',
        'settings': 'الإعدادات'
    };
    
    const pageTitle = document.getElementById('page-title');
    if (pageTitle && titles[pageId]) {
        pageTitle.textContent = titles[pageId];
    }
    
    // Load page-specific data
    if (pageId === 'customers' && currentCustomers.length === 0) {
        loadDashboardData();
    }
};

// Authentication UI functions
window.showLogin = () => {
    document.getElementById('signup-page').style.display = 'none';
    document.getElementById('login-page').style.display = 'flex';
};

window.showSignup = () => {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('signup-page').style.display = 'flex';
};

// Modal functions
window.showAddCustomerModal = () => {
    document.getElementById('modal-overlay').classList.add('active');
};

window.closeModal = () => {
    document.getElementById('modal-overlay').classList.remove('active');
    
    // Reset forms
    const forms = document.querySelectorAll('#modal-overlay form');
    forms.forEach(form => form.reset());
};

// Customer functions
window.showCustomerDetails = async (customerId) => {
    try {
        const customer = currentCustomers.find(c => c.id === customerId);
        if (!customer) {
            showAlert('العميل غير موجود', 'error');
            return;
        }
        
        // For now, just show an alert with customer info
        // In a full implementation, you would show a detailed modal
        const info = `
            الاسم: ${customer.name}
            الهاتف: ${customer.phone}
            ${customer.address ? `العنوان: ${customer.address}` : ''}
            الرصيد: ${customer.totalDebt > 0 ? formatCurrency(customer.totalDebt) : 'لا يوجد ديون'}
        `;
        
        alert(info);
        
    } catch (error) {
        console.error('Error showing customer details:', error);
        showAlert('حدث خطأ في عرض تفاصيل العميل', 'error');
    }
};

window.editCustomer = (customerId) => {
    // For now, just show an alert
    // In a full implementation, you would show an edit modal
    showAlert('وظيفة التعديل قيد التطوير', 'info');
};

// Utility functions
window.togglePassword = (inputId) => {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

window.toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
};

window.logout = logout;

// Global alert function
window.showAlert = (message, type = 'info') => {
    const alertContainer = document.getElementById('alert-container');
    const alertId = 'alert-' + Date.now();
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    const alertHTML = `
        <div id="${alertId}" class="alert ${type}">
            <i class="fas ${icons[type] || icons.info}"></i>
            <div class="alert-content">
                <div class="alert-message">${message}</div>
            </div>
        </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHTML);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        const alertEl = document.getElementById(alertId);
        if (alertEl) {
            alertEl.style.animation = 'alertSlideOut 0.3s ease-in-out forwards';
            setTimeout(() => alertEl.remove(), 300);
        }
    }, 5000);
};

// Add CSS for alert slide out animation
const style = document.createElement('style');
style.textContent = `
    @keyframes alertSlideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(-20px);
        }
    }
`;
document.head.appendChild(style);

