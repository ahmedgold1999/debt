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
    
    // Edit customer form
    const editCustomerForm = document.getElementById('edit-customer-form');
    if (editCustomerForm) {
        editCustomerForm.addEventListener('submit', handleEditCustomer);
    }
    
    // Add transaction form
    const addTransactionForm = document.getElementById('add-transaction-form');
    if (addTransactionForm) {
        addTransactionForm.addEventListener('submit', handleAddTransaction);
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
        
        const newCustomer = await customerService.addCustomer(customerData);
        
        // Add the new customer to the current list immediately
        currentCustomers.unshift(newCustomer);
        
        // Re-render the customers list
        renderCustomers(currentCustomers);
        
        // Update statistics
        currentStats = await statsService.getStoreStats();
        updateStatsDisplay();
        updateTopDebtors(currentCustomers);
        
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


// Show customer details modal
window.showCustomerDetails = async (customerId) => {
    try {
        const customer = currentCustomers.find(c => c.id === customerId);
        if (!customer) {
            showAlert('العميل غير موجود', 'error');
            return;
        }
        
        // Fill customer info
        document.getElementById('customer-details-title').textContent = `تفاصيل العميل - ${customer.name}`;
        document.getElementById('detail-customer-name').textContent = customer.name;
        document.getElementById('detail-customer-phone').textContent = customer.phone;
        document.getElementById('detail-customer-address').textContent = customer.address || 'غير محدد';
        
        const debtElement = document.getElementById('detail-customer-debt');
        if (customer.totalDebt > 0) {
            debtElement.textContent = formatCurrency(customer.totalDebt);
            debtElement.className = 'debt-amount positive';
        } else {
            debtElement.textContent = 'لا يوجد ديون';
            debtElement.className = 'debt-amount zero';
        }
        
        // Set customer ID for transactions
        document.getElementById('transaction-customer-id').value = customerId;
        
        // Load customer transactions
        await loadCustomerTransactions(customerId);
        
        // Show modal
        showModal('customer-details-modal');
        
    } catch (error) {
        console.error('Error showing customer details:', error);
        showAlert('حدث خطأ في عرض تفاصيل العميل', 'error');
    }
};

// Load customer transactions
const loadCustomerTransactions = async (customerId) => {
    const transactionsContainer = document.getElementById('customer-transactions');
    
    try {
        // Show loading
        transactionsContainer.innerHTML = `
            <div class="loading-transactions">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري تحميل المعاملات...</p>
            </div>
        `;
        
        const transactions = await transactionService.getCustomerTransactions(customerId);
        
        if (transactions.length === 0) {
            transactionsContainer.innerHTML = `
                <div class="empty-transactions">
                    <i class="fas fa-receipt"></i>
                    <p>لا توجد معاملات لهذا العميل</p>
                </div>
            `;
            return;
        }
        
        const transactionsHTML = transactions.map(transaction => `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-type ${transaction.type}">
                        <i class="fas ${transaction.type === 'debt' ? 'fa-plus' : 'fa-minus'}"></i>
                        ${transaction.type === 'debt' ? 'دين جديد' : 'دفعة'}
                    </div>
                    <div class="transaction-description">
                        ${transaction.description || 'بدون وصف'}
                    </div>
                    <div class="transaction-date">
                        ${formatDateTime(transaction.createdAt.toDate())}
                    </div>
                </div>
                <div class="transaction-actions">
                    <button class="btn btn-danger btn-icon btn-sm" onclick="deleteTransaction('${transaction.id}', '${customerId}', ${transaction.amount}, '${transaction.type}')" title="حذف المعاملة">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="transaction-amount ${transaction.type}">
                    ${transaction.type === 'debt' ? '+' : '-'}${formatCurrency(transaction.amount)}
                </div>
            </div>
        `).join('');
        
        transactionsContainer.innerHTML = transactionsHTML;
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        transactionsContainer.innerHTML = `
            <div class="empty-transactions">
                <i class="fas fa-exclamation-triangle"></i>
                <p>حدث خطأ في تحميل المعاملات</p>
            </div>
        `;
    }
};

// Edit customer
window.editCustomer = (customerId) => {
    const customer = currentCustomers.find(c => c.id === customerId);
    if (!customer) {
        showAlert('العميل غير موجود', 'error');
        return;
    }
    
    // Fill edit form
    document.getElementById('edit-customer-id').value = customer.id;
    document.getElementById('edit-customer-name').value = customer.name;
    document.getElementById('edit-customer-phone').value = customer.phone;
    document.getElementById('edit-customer-address').value = customer.address || '';
    document.getElementById('edit-customer-notes').value = customer.notes || '';
    
    // Show edit modal
    showModal('edit-customer-modal');
};

// Handle edit customer form
const handleEditCustomer = async (e) => {
    e.preventDefault();
    
    const customerId = document.getElementById('edit-customer-id').value;
    const customerData = {
        name: document.getElementById('edit-customer-name').value,
        phone: document.getElementById('edit-customer-phone').value,
        address: document.getElementById('edit-customer-address').value,
        notes: document.getElementById('edit-customer-notes').value
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
    
    // Check if phone already exists for another customer
    const existingCustomer = currentCustomers.find(c => c.phone === customerData.phone && c.id !== customerId);
    if (existingCustomer) {
        showAlert('رقم الهاتف مسجل بالفعل لعميل آخر', 'error');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        
        await customerService.updateCustomer(customerId, customerData);
        
        // Update customer in current list
        const customerIndex = currentCustomers.findIndex(c => c.id === customerId);
        if (customerIndex !== -1) {
            currentCustomers[customerIndex] = { ...currentCustomers[customerIndex], ...customerData };
            renderCustomers(currentCustomers);
        }
        
        showAlert('تم تحديث بيانات العميل بنجاح', 'success');
        closeModal();
        
    } catch (error) {
        console.error('Edit customer error:', error);
        showAlert('حدث خطأ في تحديث بيانات العميل', 'error');
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'حفظ التعديلات';
    }
};

// Handle add transaction
const handleAddTransaction = async (e) => {
    e.preventDefault();
    
    const customerId = document.getElementById('transaction-customer-id').value;
    const transactionData = {
        type: document.getElementById('transaction-type').value,
        amount: parseFloat(document.getElementById('transaction-amount').value),
        description: document.getElementById('transaction-description').value
    };
    
    // Validation
    if (!transactionData.type || !transactionData.amount || transactionData.amount <= 0) {
        showAlert('يرجى إدخال جميع البيانات المطلوبة', 'warning');
        return;
    }
    
    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';
        
        const user = getCurrentUser();
        await transactionService.addTransaction(user.uid, customerId, transactionData);
        
        // Update customer debt in current list
        const customerIndex = currentCustomers.findIndex(c => c.id === customerId);
        if (customerIndex !== -1) {
            const increment = transactionData.type === 'debt' ? transactionData.amount : -transactionData.amount;
            currentCustomers[customerIndex].totalDebt += increment;
            
            // Update debt display in modal
            const customer = currentCustomers[customerIndex];
            const debtElement = document.getElementById('detail-customer-debt');
            if (customer.totalDebt > 0) {
                debtElement.textContent = formatCurrency(customer.totalDebt);
                debtElement.className = 'debt-amount positive';
            } else {
                debtElement.textContent = 'لا يوجد ديون';
                debtElement.className = 'debt-amount zero';
            }
        }
        
        // Reload transactions
        await loadCustomerTransactions(customerId);
        
        // Re-render customers list
        renderCustomers(currentCustomers);
        
        // Update statistics
        currentStats = await statsService.getStoreStats();
        updateStatsDisplay();
        updateTopDebtors(currentCustomers);
        
        showAlert(`تم إضافة ${transactionData.type === 'debt' ? 'الدين' : 'الدفعة'} بنجاح`, 'success');
        e.target.reset();
        
    } catch (error) {
        console.error('Add transaction error:', error);
        showAlert('حدث خطأ في إضافة المعاملة', 'error');
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> إضافة المعاملة';
    }
};

// Delete transaction
window.deleteTransaction = async (transactionId, customerId, amount, type) => {
    if (!confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
        return;
    }
    
    try {
        await transactionService.deleteTransaction(transactionId, customerId, amount, type);
        
        // Update customer debt in current list
        const customerIndex = currentCustomers.findIndex(c => c.id === customerId);
        if (customerIndex !== -1) {
            const increment = type === 'debt' ? -amount : amount;
            currentCustomers[customerIndex].totalDebt += increment;
            
            // Update debt display in modal
            const customer = currentCustomers[customerIndex];
            const debtElement = document.getElementById('detail-customer-debt');
            if (customer.totalDebt > 0) {
                debtElement.textContent = formatCurrency(customer.totalDebt);
                debtElement.className = 'debt-amount positive';
            } else {
                debtElement.textContent = 'لا يوجد ديون';
                debtElement.className = 'debt-amount zero';
            }
        }
        
        // Reload transactions
        await loadCustomerTransactions(customerId);
        
        // Re-render customers list
        renderCustomers(currentCustomers);
        
        // Update statistics
        currentStats = await statsService.getStoreStats();
        updateStatsDisplay();
        updateTopDebtors(currentCustomers);
        
        showAlert('تم حذف المعاملة بنجاح', 'success');
        
    } catch (error) {
        console.error('Delete transaction error:', error);
        showAlert('حدث خطأ في حذف المعاملة', 'error');
    }
};

// Show specific modal
const showModal = (modalId) => {
    // Hide all modals first
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    // Show target modal
    document.getElementById(modalId).style.display = 'block';
    document.getElementById('modal-overlay').classList.add('active');
};

// Update modal functions
window.showAddCustomerModal = () => {
    showModal('add-customer-modal');
};

// Update close modal function
window.closeModal = () => {
    document.getElementById('modal-overlay').classList.remove('active');
    
    // Hide all modals
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    // Reset forms
    const forms = document.querySelectorAll('#modal-overlay form');
    forms.forEach(form => form.reset());
};


// Transactions page functionality
let currentTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
const transactionsPerPage = 10;

// Load transactions page
const loadTransactionsPage = async () => {
    try {
        // Load all transactions
        currentTransactions = await transactionService.getStoreTransactions(null, 1000);
        filteredTransactions = [...currentTransactions];
        
        // Populate customer filter
        populateCustomerFilter();
        
        // Update summary
        updateTransactionsSummary();
        
        // Render transactions table
        renderTransactionsTable();
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        showAlert('حدث خطأ في تحميل المعاملات', 'error');
    }
};

// Populate customer filter dropdown
const populateCustomerFilter = () => {
    const customerFilter = document.getElementById('transaction-filter-customer');
    if (!customerFilter) return;
    
    // Clear existing options except the first one
    customerFilter.innerHTML = '<option value="">جميع العملاء</option>';
    
    // Get unique customers from transactions
    const customerIds = [...new Set(currentTransactions.map(t => t.customerId))];
    
    customerIds.forEach(customerId => {
        const customer = currentCustomers.find(c => c.id === customerId);
        if (customer) {
            const option = document.createElement('option');
            option.value = customerId;
            option.textContent = customer.name;
            customerFilter.appendChild(option);
        }
    });
};

// Update transactions summary
const updateTransactionsSummary = () => {
    const debts = filteredTransactions.filter(t => t.type === 'debt');
    const payments = filteredTransactions.filter(t => t.type === 'payment');
    
    const totalDebts = debts.reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);
    const netAmount = totalDebts - totalPayments;
    
    // Update summary cards
    document.getElementById('total-debts-amount').textContent = formatCurrency(totalDebts);
    document.getElementById('total-debts-count').textContent = `${debts.length} معاملة`;
    
    document.getElementById('total-payments-amount').textContent = formatCurrency(totalPayments);
    document.getElementById('total-payments-count').textContent = `${payments.length} معاملة`;
    
    document.getElementById('net-amount').textContent = formatCurrency(netAmount);
    document.getElementById('total-transactions-count').textContent = `${filteredTransactions.length} معاملة`;
};

// Filter transactions
window.filterTransactions = () => {
    const typeFilter = document.getElementById('transaction-filter-type').value;
    const customerFilter = document.getElementById('transaction-filter-customer').value;
    const dateFilter = document.getElementById('transaction-filter-date').value;
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    
    // Show/hide custom date range
    const customDateRange = document.getElementById('custom-date-range');
    if (dateFilter === 'custom') {
        customDateRange.style.display = 'block';
    } else {
        customDateRange.style.display = 'none';
    }
    
    filteredTransactions = currentTransactions.filter(transaction => {
        // Type filter
        if (typeFilter && transaction.type !== typeFilter) {
            return false;
        }
        
        // Customer filter
        if (customerFilter && transaction.customerId !== customerFilter) {
            return false;
        }
        
        // Date filter
        if (dateFilter) {
            const transactionDate = transaction.createdAt.toDate();
            const today = new Date();
            
            switch (dateFilter) {
                case 'today':
                    if (!isSameDay(transactionDate, today)) return false;
                    break;
                case 'week':
                    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                    if (transactionDate < weekAgo) return false;
                    break;
                case 'month':
                    const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                    if (transactionDate < monthAgo) return false;
                    break;
                case 'custom':
                    if (dateFrom && transactionDate < new Date(dateFrom)) return false;
                    if (dateTo && transactionDate > new Date(dateTo + 'T23:59:59')) return false;
                    break;
            }
        }
        
        return true;
    });
    
    // Reset to first page
    currentPage = 1;
    
    // Update summary and table
    updateTransactionsSummary();
    renderTransactionsTable();
};

// Check if two dates are the same day
const isSameDay = (date1, date2) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
};

// Render transactions table
const renderTransactionsTable = () => {
    const tableBody = document.getElementById('transactions-table-body');
    const pagination = document.getElementById('transactions-pagination');
    
    if (filteredTransactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="no-data">لا توجد معاملات</td></tr>';
        pagination.style.display = 'none';
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
    const startIndex = (currentPage - 1) * transactionsPerPage;
    const endIndex = Math.min(startIndex + transactionsPerPage, filteredTransactions.length);
    const pageTransactions = filteredTransactions.slice(startIndex, endIndex);
    
    // Render table rows
    const tableHTML = pageTransactions.map(transaction => {
        const customer = currentCustomers.find(c => c.id === transaction.customerId);
        const customerName = customer ? customer.name : 'عميل محذوف';
        
        return `
            <tr>
                <td>${formatDateTime(transaction.createdAt.toDate())}</td>
                <td>${customerName}</td>
                <td>
                    <span class="transaction-type-badge ${transaction.type}">
                        <i class="fas ${transaction.type === 'debt' ? 'fa-plus' : 'fa-minus'}"></i>
                        ${transaction.type === 'debt' ? 'دين' : 'دفعة'}
                    </span>
                </td>
                <td>${transaction.description || 'بدون وصف'}</td>
                <td class="transaction-amount-cell ${transaction.type}">
                    ${transaction.type === 'debt' ? '+' : '-'}${formatCurrency(transaction.amount)}
                </td>
                <td>
                    <div class="transaction-actions">
                        <button class="btn btn-danger btn-sm" onclick="deleteTransactionFromTable('${transaction.id}', '${transaction.customerId}', ${transaction.amount}, '${transaction.type}')" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    tableBody.innerHTML = tableHTML;
    
    // Update pagination
    updatePagination(totalPages, startIndex, endIndex);
};

// Update pagination
const updatePagination = (totalPages, startIndex, endIndex) => {
    const pagination = document.getElementById('transactions-pagination');
    const paginationInfo = document.getElementById('pagination-info-text');
    const paginationNumbers = document.getElementById('pagination-numbers');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    pagination.style.display = 'flex';
    
    // Update info text
    paginationInfo.textContent = `عرض ${startIndex + 1}-${endIndex} من ${filteredTransactions.length} معاملة`;
    
    // Update buttons
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
    
    // Update page numbers
    let numbersHTML = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        numbersHTML += `
            <a href="#" class="pagination-number ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i}); return false;">
                ${i}
            </a>
        `;
    }
    
    paginationNumbers.innerHTML = numbersHTML;
};

// Pagination functions
window.previousPage = () => {
    if (currentPage > 1) {
        currentPage--;
        renderTransactionsTable();
    }
};

window.nextPage = () => {
    const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTransactionsTable();
    }
};

window.goToPage = (page) => {
    currentPage = page;
    renderTransactionsTable();
};

// Refresh transactions
window.refreshTransactions = async () => {
    await loadTransactionsPage();
    showAlert('تم تحديث المعاملات', 'success');
};

// Delete transaction from table
window.deleteTransactionFromTable = async (transactionId, customerId, amount, type) => {
    if (!confirm('هل أنت متأكد من حذف هذه المعاملة؟')) {
        return;
    }
    
    try {
        await transactionService.deleteTransaction(transactionId, customerId, amount, type);
        
        // Update customer debt in current list
        const customerIndex = currentCustomers.findIndex(c => c.id === customerId);
        if (customerIndex !== -1) {
            const increment = type === 'debt' ? -amount : amount;
            currentCustomers[customerIndex].totalDebt += increment;
        }
        
        // Reload transactions
        await loadTransactionsPage();
        
        // Re-render customers list if on customers page
        renderCustomers(currentCustomers);
        
        // Update statistics
        currentStats = await statsService.getStoreStats();
        updateStatsDisplay();
        updateTopDebtors(currentCustomers);
        
        showAlert('تم حذف المعاملة بنجاح', 'success');
        
    } catch (error) {
        console.error('Delete transaction error:', error);
        showAlert('حدث خطأ في حذف المعاملة', 'error');
    }
};

// Export transactions
window.exportTransactions = () => {
    if (filteredTransactions.length === 0) {
        showAlert('لا توجد معاملات للتصدير', 'warning');
        return;
    }
    
    // Create CSV content
    const headers = ['التاريخ', 'العميل', 'النوع', 'الوصف', 'المبلغ'];
    const csvContent = [
        headers.join(','),
        ...filteredTransactions.map(transaction => {
            const customer = currentCustomers.find(c => c.id === transaction.customerId);
            const customerName = customer ? customer.name : 'عميل محذوف';
            
            return [
                formatDateTime(transaction.createdAt.toDate()),
                customerName,
                transaction.type === 'debt' ? 'دين' : 'دفعة',
                transaction.description || 'بدون وصف',
                transaction.amount
            ].join(',');
        })
    ].join('\n');
    
    // Download CSV file
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showAlert('تم تصدير المعاملات بنجاح', 'success');
};

// Quick add transaction modal
window.showQuickAddTransaction = () => {
    // This would show a modal for quick transaction entry
    // For now, just show an alert
    showAlert('وظيفة المعاملة السريعة قيد التطوير', 'info');
};

// Update showPage function to load transactions when needed
const originalShowPage = window.showPage;
window.showPage = (pageId) => {
    originalShowPage(pageId);
    
    // Load page-specific data
    if (pageId === 'transactions') {
        loadTransactionsPage();
    }
};


// Settings page functionality
let currentSettings = {
    currency: 'SAR',
    dateFormat: 'DD/MM/YYYY',
    itemsPerPage: 10,
    darkMode: false,
    notifications: true,
    autoSave: true
};

// Load settings page
const loadSettingsPage = async () => {
    try {
        // Load store information
        await loadStoreInfo();
        
        // Load account information
        await loadAccountInfo();
        
        // Load user preferences
        loadUserPreferences();
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showAlert('حدث خطأ في تحميل الإعدادات', 'error');
    }
};

// Load store information
const loadStoreInfo = async () => {
    try {
        const user = getCurrentUser();
        const storeInfo = await storeService.getStoreInfo(user.uid);
        
        if (storeInfo) {
            document.getElementById('store-name').value = storeInfo.name || '';
            document.getElementById('store-phone').value = storeInfo.phone || '';
            document.getElementById('store-email').value = storeInfo.email || '';
            document.getElementById('store-cr').value = storeInfo.cr || '';
            document.getElementById('store-address').value = storeInfo.address || '';
            document.getElementById('store-description').value = storeInfo.description || '';
        }
    } catch (error) {
        console.error('Error loading store info:', error);
    }
};

// Load account information
const loadAccountInfo = async () => {
    try {
        const user = getCurrentUser();
        
        document.getElementById('current-email').textContent = user.email;
        document.getElementById('account-created').textContent = formatDateTime(user.metadata.creationTime);
        document.getElementById('last-login').textContent = formatDateTime(user.metadata.lastSignInTime);
        
    } catch (error) {
        console.error('Error loading account info:', error);
    }
};

// Load user preferences
const loadUserPreferences = () => {
    // Load from localStorage
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
        currentSettings = { ...currentSettings, ...JSON.parse(savedSettings) };
    }
    
    // Apply to form
    document.getElementById('default-currency').value = currentSettings.currency;
    document.getElementById('date-format').value = currentSettings.dateFormat;
    document.getElementById('items-per-page').value = currentSettings.itemsPerPage;
    document.getElementById('dark-mode').checked = currentSettings.darkMode;
    document.getElementById('notifications').checked = currentSettings.notifications;
    document.getElementById('auto-save').checked = currentSettings.autoSave;
    
    // Apply dark mode if enabled
    if (currentSettings.darkMode) {
        document.body.classList.add('dark-mode');
    }
};

// Save preferences
window.savePreferences = () => {
    currentSettings = {
        currency: document.getElementById('default-currency').value,
        dateFormat: document.getElementById('date-format').value,
        itemsPerPage: parseInt(document.getElementById('items-per-page').value),
        darkMode: document.getElementById('dark-mode').checked,
        notifications: document.getElementById('notifications').checked,
        autoSave: document.getElementById('auto-save').checked
    };
    
    // Save to localStorage
    localStorage.setItem('userSettings', JSON.stringify(currentSettings));
    
    // Apply dark mode
    if (currentSettings.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    showAlert('تم حفظ التفضيلات بنجاح', 'success');
};

// Export all data
window.exportAllData = async () => {
    try {
        const user = getCurrentUser();
        
        // Get all data
        const [customers, transactions, storeInfo] = await Promise.all([
            customerService.getCustomers(user.uid),
            transactionService.getStoreTransactions(user.uid, 10000),
            storeService.getStoreInfo(user.uid)
        ]);
        
        const exportData = {
            exportDate: new Date().toISOString(),
            storeInfo,
            customers: customers.map(customer => ({
                ...customer,
                createdAt: customer.createdAt.toDate().toISOString()
            })),
            transactions: transactions.map(transaction => ({
                ...transaction,
                createdAt: transaction.createdAt.toDate().toISOString()
            }))
        };
        
        // Create and download JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `store_data_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showAlert('تم تصدير البيانات بنجاح', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showAlert('حدث خطأ في تصدير البيانات', 'error');
    }
};

// Update showPage function to load settings when needed
const originalShowPageForSettings = window.showPage;
window.showPage = (pageId) => {
    originalShowPageForSettings(pageId);
    
    // Load page-specific data
    if (pageId === 'settings') {
        loadSettingsPage();
    } else if (pageId === 'transactions') {
        loadTransactionsPage();
    }
};


// Receipt functionality
let currentReceipt = null;

// Generate and show receipt
window.generateReceipt = (transaction, customer, storeInfo) => {
    const receiptNumber = generateReceiptNumber();
    const receiptDate = new Date();
    
    currentReceipt = {
        number: receiptNumber,
        date: receiptDate,
        transaction,
        customer,
        storeInfo: storeInfo || {
            name: 'مكتبة القرطاسية',
            address: 'بغداد، العراق',
            phone: '07XX XXX XXXX',
            email: 'info@stationery.iq'
        }
    };
    
    renderReceipt();
    showModal('receipt-modal');
};

// Render receipt content
const renderReceipt = () => {
    if (!currentReceipt) return;
    
    const { number, date, transaction, customer, storeInfo } = currentReceipt;
    
    const receiptHTML = `
        <div class="receipt-content">
            <div class="receipt-title">
                <h1>${storeInfo.name}</h1>
                <p>وصل تسديد رقم: ${number}</p>
            </div>
            
            <div class="receipt-info">
                <div class="info-section">
                    <h3>معلومات المكتب</h3>
                    <div class="info-item">
                        <span class="info-label">الاسم:</span>
                        <span class="info-value">${storeInfo.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">العنوان:</span>
                        <span class="info-value">${storeInfo.address}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">الهاتف:</span>
                        <span class="info-value">${formatIraqiPhone(storeInfo.phone)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">البريد:</span>
                        <span class="info-value">${storeInfo.email}</span>
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>معلومات العميل</h3>
                    <div class="info-item">
                        <span class="info-label">الاسم:</span>
                        <span class="info-value">${customer.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">الهاتف:</span>
                        <span class="info-value">${formatIraqiPhone(customer.phone)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">التاريخ:</span>
                        <span class="info-value">${formatDateTime(date)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">رقم الوصل:</span>
                        <span class="info-value">${number}</span>
                    </div>
                </div>
            </div>
            
            <div class="receipt-details">
                <h3>تفاصيل التسديد</h3>
                <div class="amount-display">
                    <div class="amount">${formatCurrency(transaction.amount)}</div>
                    <div class="amount-text">المبلغ المسدد</div>
                </div>
                
                <div class="info-item">
                    <span class="info-label">نوع المعاملة:</span>
                    <span class="info-value">${transaction.type === 'payment' ? 'تسديد' : 'دين'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">الوصف:</span>
                    <span class="info-value">${transaction.description || 'تسديد دين'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">الرصيد المتبقي:</span>
                    <span class="info-value">${formatCurrency(customer.totalDebt || 0)}</span>
                </div>
            </div>
            
            <div class="receipt-signature">
                <div class="signature-section">
                    <div class="signature-line"></div>
                    <div class="signature-label">توقيع العميل</div>
                </div>
                <div class="signature-section">
                    <div class="signature-line"></div>
                    <div class="signature-label">توقيع المكتب</div>
                </div>
            </div>
            
            <div class="receipt-footer">
                <p>شكراً لتعاملكم معنا</p>
                <p>تم إنشاء هذا الوصل بتاريخ ${formatDateTime(date)}</p>
            </div>
        </div>
    `;
    
    document.getElementById('receipt-content').innerHTML = receiptHTML;
};

// Print receipt
window.printReceipt = () => {
    window.print();
};

// Download receipt as PDF
window.downloadReceipt = () => {
    if (!currentReceipt) return;
    
    // Create a new window for PDF generation
    const printWindow = window.open('', '_blank');
    const receiptContent = document.getElementById('receipt-content').innerHTML;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>وصل تسديد - ${currentReceipt.number}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
            <style>
                body { 
                    font-family: 'Cairo', sans-serif; 
                    margin: 20px; 
                    direction: rtl; 
                    line-height: 1.6;
                }
                .receipt-content { max-width: 600px; margin: 0 auto; }
                .receipt-title { text-align: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #3b82f6; }
                .receipt-title h1 { color: #3b82f6; font-size: 2rem; margin-bottom: 0.5rem; }
                .receipt-info { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
                .info-section h3 { color: #3b82f6; font-size: 1.125rem; margin-bottom: 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
                .info-item { display: flex; justify-content: space-between; margin-bottom: 0.75rem; padding: 0.5rem 0; }
                .info-label { font-weight: 600; color: #555; }
                .info-value { color: #333; font-weight: 500; }
                .receipt-details { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; border: 1px solid #e9ecef; }
                .amount-display { text-align: center; padding: 1.5rem; background: linear-gradient(135deg, #10b981, #059669); color: white; border-radius: 8px; margin: 1rem 0; }
                .amount-display .amount { font-size: 2.5rem; font-weight: 700; margin-bottom: 0.5rem; }
                .receipt-signature { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; }
                .signature-section { text-align: center; }
                .signature-line { border-bottom: 1px solid #333; margin-bottom: 0.5rem; height: 50px; }
                .signature-label { font-weight: 600; color: #555; }
                .receipt-footer { text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; color: #666; font-size: 0.875rem; }
            </style>
        </head>
        <body>
            ${receiptContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};

// Share receipt
window.shareReceipt = () => {
    if (!currentReceipt) return;
    
    const shareText = `وصل تسديد رقم: ${currentReceipt.number}
العميل: ${currentReceipt.customer.name}
المبلغ: ${formatCurrency(currentReceipt.transaction.amount)}
التاريخ: ${formatDateTime(currentReceipt.date)}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'وصل تسديد',
            text: shareText
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            showAlert('تم نسخ تفاصيل الوصل', 'success');
        });
    }
};

// Enhanced reports functionality
window.loadReportsPage = async () => {
    try {
        const user = getCurrentUser();
        
        // Load all data for reports
        const [customers, transactions, storeInfo] = await Promise.all([
            customerService.getCustomers(user.uid),
            transactionService.getStoreTransactions(user.uid, 1000),
            storeService.getStoreInfo(user.uid)
        ]);
        
        // Generate comprehensive reports
        generateReportsData(customers, transactions, storeInfo);
        
    } catch (error) {
        console.error('Error loading reports:', error);
        showAlert('حدث خطأ في تحميل التقارير', 'error');
    }
};

// Generate reports data
const generateReportsData = (customers, transactions, storeInfo) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate key metrics
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.totalDebt > 0).length;
    const totalDebt = customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
    
    const payments = transactions.filter(t => t.type === 'payment');
    const debts = transactions.filter(t => t.type === 'debt');
    
    const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);
    const totalDebtsAmount = debts.reduce((sum, t) => sum + t.amount, 0);
    
    // Update metrics display
    document.getElementById('total-revenue').textContent = formatCurrency(totalDebtsAmount);
    document.getElementById('total-collections').textContent = formatCurrency(totalPayments);
    document.getElementById('outstanding-debt').textContent = formatCurrency(totalDebt);
    document.getElementById('active-customers').textContent = activeCustomers;
    
    // Generate customer rankings
    generateCustomerRankings(customers);
    
    // Generate debt status breakdown
    generateDebtStatusBreakdown(customers);
    
    // Generate recent activity
    generateRecentActivity(transactions.slice(0, 10));
    
    // Update summary statistics
    updateSummaryStatistics(transactions, customers);
};

// Generate customer rankings
const generateCustomerRankings = (customers) => {
    const topCustomers = customers
        .sort((a, b) => (b.totalDebt || 0) - (a.totalDebt || 0))
        .slice(0, 5);
    
    const rankingsHTML = topCustomers.map((customer, index) => {
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        return `
            <div class="customer-rank-item">
                <div class="rank-number ${rankClass}">${index + 1}</div>
                <div class="customer-rank-info">
                    <div class="customer-rank-name">${customer.name}</div>
                    <div class="customer-rank-details">${formatIraqiPhone(customer.phone)}</div>
                </div>
                <div class="customer-rank-amount">${formatCurrency(customer.totalDebt || 0)}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('top-customers-list').innerHTML = rankingsHTML || '<p>لا توجد بيانات</p>';
};

// Generate debt status breakdown
const generateDebtStatusBreakdown = (customers) => {
    const noDebt = customers.filter(c => (c.totalDebt || 0) <= 0).length;
    const lowDebt = customers.filter(c => (c.totalDebt || 0) > 0 && (c.totalDebt || 0) <= 50000).length;
    const highDebt = customers.filter(c => (c.totalDebt || 0) > 50000).length;
    
    document.getElementById('no-debt-count').textContent = noDebt;
    document.getElementById('low-debt-count').textContent = lowDebt;
    document.getElementById('high-debt-count').textContent = highDebt;
};

// Generate recent activity
const generateRecentActivity = (transactions) => {
    const activityHTML = transactions.map(transaction => {
        const iconClass = transaction.type === 'payment' ? 'payment' : 'debt';
        const amountClass = transaction.type === 'payment' ? 'payment' : 'debt';
        const sign = transaction.type === 'payment' ? '+' : '-';
        
        return `
            <div class="activity-item">
                <div class="activity-icon ${iconClass}">
                    <i class="fas fa-${transaction.type === 'payment' ? 'arrow-down' : 'arrow-up'}"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-description">
                        ${transaction.type === 'payment' ? 'تسديد من' : 'دين على'} ${transaction.customerName}
                    </div>
                    <div class="activity-time">${formatDateTime(transaction.createdAt.toDate())}</div>
                </div>
                <div class="activity-amount ${amountClass}">
                    ${sign}${formatCurrency(transaction.amount)}
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('recent-activity').innerHTML = activityHTML || '<p>لا توجد معاملات حديثة</p>';
};

// Update summary statistics
const updateSummaryStatistics = (transactions, customers) => {
    const transactionCount = transactions.length;
    const avgTransaction = transactionCount > 0 ? 
        transactions.reduce((sum, t) => sum + t.amount, 0) / transactionCount : 0;
    const maxTransaction = transactionCount > 0 ? 
        Math.max(...transactions.map(t => t.amount)) : 0;
    const minTransaction = transactionCount > 0 ? 
        Math.min(...transactions.map(t => t.amount)) : 0;
    
    const payments = transactions.filter(t => t.type === 'payment');
    const debts = transactions.filter(t => t.type === 'debt');
    const totalPayments = payments.reduce((sum, t) => sum + t.amount, 0);
    const totalDebts = debts.reduce((sum, t) => sum + t.amount, 0);
    const collectionRate = totalDebts > 0 ? (totalPayments / totalDebts * 100) : 0;
    
    document.getElementById('period-transactions-count').textContent = transactionCount;
    document.getElementById('avg-transaction-value').textContent = formatCurrency(avgTransaction);
    document.getElementById('max-transaction-value').textContent = formatCurrency(maxTransaction);
    document.getElementById('min-transaction-value').textContent = formatCurrency(minTransaction);
    document.getElementById('collection-rate').textContent = `${collectionRate.toFixed(1)}%`;
    document.getElementById('new-customers-count').textContent = customers.length;
};

// Enhanced phone number validation for Iraqi numbers
const validateAndFormatPhone = (input) => {
    const phone = input.value;
    const isValid = validateIraqiPhone(phone);
    const formGroup = input.closest('.form-group');
    
    // Remove existing validation classes
    formGroup.classList.remove('valid', 'invalid');
    
    // Remove existing validation message
    const existingMessage = formGroup.querySelector('.validation-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    if (phone && !isValid) {
        formGroup.classList.add('invalid');
        const message = document.createElement('span');
        message.className = 'validation-message error';
        message.textContent = 'رقم الهاتف غير صحيح. استخدم تنسيق: 07XX XXX XXXX';
        formGroup.appendChild(message);
    } else if (phone && isValid) {
        formGroup.classList.add('valid');
        input.value = formatIraqiPhone(phone);
    }
    
    return isValid;
};

// Add phone validation to all phone inputs
document.addEventListener('DOMContentLoaded', () => {
    const phoneInputs = document.querySelectorAll('input[type="tel"], input[placeholder*="07"]');
    phoneInputs.forEach(input => {
        input.addEventListener('blur', () => validateAndFormatPhone(input));
        input.addEventListener('input', () => {
            // Real-time formatting
            const formatted = formatIraqiPhone(input.value);
            if (formatted !== input.value) {
                const cursorPos = input.selectionStart;
                input.value = formatted;
                input.setSelectionRange(cursorPos, cursorPos);
            }
        });
    });
});

// Update currency display throughout the app
const updateCurrencyDisplay = () => {
    const currencyElements = document.querySelectorAll('.currency, .amount, .total-debt, .total-paid');
    currencyElements.forEach(element => {
        if (element.textContent && !isNaN(parseFloat(element.textContent))) {
            const amount = parseFloat(element.textContent);
            element.textContent = formatCurrency(amount);
        }
    });
};

