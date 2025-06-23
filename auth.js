import { auth, db, COLLECTIONS } from './firebase.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    doc, 
    setDoc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Current user state
let currentUser = null;

// Authentication state observer
export const initAuth = () => {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                // Get user store data
                try {
                    const storeDoc = await getDoc(doc(db, COLLECTIONS.STORES, user.uid));
                    if (storeDoc.exists()) {
                        currentUser.storeData = storeDoc.data();
                    }
                } catch (error) {
                    console.error('Error fetching store data:', error);
                }
                showDashboard();
            } else {
                currentUser = null;
                showAuth();
            }
            resolve(user);
        });
    });
};

// Get current user
export const getCurrentUser = () => currentUser;

// Sign up new user
export const signUp = async (userData) => {
    try {
        const { email, password, storeName, ownerName, phone, address } = userData;
        
        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update user profile
        await updateProfile(user, {
            displayName: ownerName
        });
        
        // Create store document
        const storeData = {
            name: storeName,
            ownerName: ownerName,
            email: email,
            phone: phone,
            address: address,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        await setDoc(doc(db, COLLECTIONS.STORES, user.uid), storeData);
        
        showAlert('تم إنشاء الحساب بنجاح!', 'success');
        return user;
    } catch (error) {
        console.error('Sign up error:', error);
        let message = 'حدث خطأ في إنشاء الحساب';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'البريد الإلكتروني مستخدم بالفعل';
                break;
            case 'auth/weak-password':
                message = 'كلمة المرور ضعيفة جداً';
                break;
            case 'auth/invalid-email':
                message = 'البريد الإلكتروني غير صحيح';
                break;
        }
        
        showAlert(message, 'error');
        throw error;
    }
};

// Sign in user
export const signIn = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        showAlert('تم تسجيل الدخول بنجاح!', 'success');
        return userCredential.user;
    } catch (error) {
        console.error('Sign in error:', error);
        let message = 'حدث خطأ في تسجيل الدخول';
        
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'المستخدم غير موجود';
                break;
            case 'auth/wrong-password':
                message = 'كلمة المرور غير صحيحة';
                break;
            case 'auth/invalid-email':
                message = 'البريد الإلكتروني غير صحيح';
                break;
            case 'auth/too-many-requests':
                message = 'تم تجاوز عدد المحاولات المسموح، حاول لاحقاً';
                break;
        }
        
        showAlert(message, 'error');
        throw error;
    }
};

// Sign out user
export const logout = async () => {
    try {
        await signOut(auth);
        showAlert('تم تسجيل الخروج بنجاح', 'info');
    } catch (error) {
        console.error('Sign out error:', error);
        showAlert('حدث خطأ في تسجيل الخروج', 'error');
    }
};

// Show authentication pages
const showAuth = () => {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('login-page').style.display = 'flex';
};

// Show dashboard
const showDashboard = () => {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('signup-page').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    
    // Update user info in sidebar
    if (currentUser) {
        const userNameEl = document.getElementById('user-name');
        const userEmailEl = document.getElementById('user-email');
        
        if (userNameEl) userNameEl.textContent = currentUser.displayName || 'مالك المكتبة';
        if (userEmailEl) userEmailEl.textContent = currentUser.email;
    }
    
    // Load dashboard data
    if (window.loadDashboardData) {
        window.loadDashboardData();
    }
};

// Show alert message
const showAlert = (message, type = 'info') => {
    const alertContainer = document.getElementById('alert-container');
    const alertId = 'alert-' + Date.now();
    
    const alertHTML = `
        <div id="${alertId}" class="alert ${type}">
            <i class="fas ${getAlertIcon(type)}"></i>
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

// Get alert icon based on type
const getAlertIcon = (type) => {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
};

// Export showAlert for global use
window.showAlert = showAlert;

