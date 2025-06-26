// Firebase configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your Firebase config
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Database collections
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

// Currency formatting for Iraqi Dinar
export const formatCurrency = (amount) => {
  if (typeof amount !== 'number') {
    amount = parseFloat(amount) || 0;
  }
  return new Intl.NumberFormat('ar-IQ', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount) + ' د.ع';
};

// Format Iraqi phone number
export const formatIraqiPhone = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Iraqi phone number patterns
  if (digits.length === 11 && digits.startsWith('964')) {
    // International format: +964 XXX XXX XXXX
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  } else if (digits.length === 10 && digits.startsWith('07')) {
    // Local format: 07XX XXX XXXX
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  } else if (digits.length === 8) {
    // Landline: XXXX XXXX
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  
  return phone; // Return original if doesn't match patterns
};

// Validate Iraqi phone number
export const validateIraqiPhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10 && digits.startsWith('07')) {
    return true;
  } else if (digits.length === 11 && digits.startsWith('964')) {
    return true;
  } else if (digits.length === 8) {
    return true;
  }
  
  return false;
};

// Date formatting
export const formatDate = (date) => {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
};

export const formatDateTime = (date) => {
  if (!date) return '';
  
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
};

// Generate receipt number
export const generateReceiptNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  
  return `${year}${month}${day}${random}`;
};

// Calculate debt status
export const getDebtStatus = (amount) => {
  if (amount <= 0) return 'paid';
  if (amount <= 50000) return 'low'; // Less than 50,000 IQD
  if (amount <= 200000) return 'medium'; // Less than 200,000 IQD
  return 'high'; // More than 200,000 IQD
};
