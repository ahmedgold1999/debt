// Firebase configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase config - يجب استبدال هذه القيم بقيم مشروعك الفعلي
const firebaseConfig = {
  apiKey: "AIzaSyDdro4qZYzidVrlHo0V6ePBumcWBr52rR8",
  authDomain: "debts-c0431.firebaseapp.com",
  databaseURL: "https://debts-c0431-default-rtdb.firebaseio.com",
  projectId: "debts-c0431",
  storageBucket: "debts-c0431.appspot.com",
  messagingSenderId: "663403309589",
  appId: "1:663403309589:web:687eae170c655a19f07c1c",
  measurementId: "G-J6FDP491WC"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Collections
export const COLLECTIONS = {
    STORES: 'stores',
    CUSTOMERS: 'customers',
    TRANSACTIONS: 'transactions'
};

// Transaction types
export const TRANSACTION_TYPES = {
    DEBT: 'debt',
    PAYMENT: 'payment'
};

// Utility functions
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-SA', {
        style: 'currency',
        currency: 'SAR',
        minimumFractionDigits: 2
    }).format(amount);
};

export const formatDate = (date) => {
    return new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(date));
};

export const formatDateTime = (date) => {
    return new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
};

