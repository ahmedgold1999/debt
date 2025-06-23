import { db, COLLECTIONS, TRANSACTION_TYPES } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    getDocs, 
    getDoc,
    query, 
    where, 
    orderBy, 
    limit,
    onSnapshot,
    writeBatch,
    increment
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Customer operations
export const customerService = {
    // Add new customer
    async addCustomer(customerData) {
        const user = getCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        const customer = {
            ...customerData,
            storeId: user.uid,
            totalDebt: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const docRef = await addDoc(collection(db, COLLECTIONS.CUSTOMERS), customer);
        return { id: docRef.id, ...customer };
    },
    
    // Get all customers for store
    async getCustomers(storeId = null) {
        const user = getCurrentUser();
        const targetStoreId = storeId || user?.uid;
        if (!targetStoreId) throw new Error('Store ID required');
        
        const q = query(
            collection(db, COLLECTIONS.CUSTOMERS),
            where('storeId', '==', targetStoreId),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },
    
    // Get customer by ID
    async getCustomer(customerId) {
        const docRef = doc(db, COLLECTIONS.CUSTOMERS, customerId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            throw new Error('Customer not found');
        }
    },
    
    // Update customer
    async updateCustomer(customerId, updateData) {
        const docRef = doc(db, COLLECTIONS.CUSTOMERS, customerId);
        await updateDoc(docRef, {
            ...updateData,
            updatedAt: new Date()
        });
    },
    
    // Delete customer
    async deleteCustomer(customerId) {
        // First, delete all transactions for this customer
        const transactions = await transactionService.getCustomerTransactions(customerId);
        const batch = writeBatch(db);
        
        transactions.forEach(transaction => {
            const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
            batch.delete(transactionRef);
        });
        
        // Delete customer
        const customerRef = doc(db, COLLECTIONS.CUSTOMERS, customerId);
        batch.delete(customerRef);
        
        await batch.commit();
    },
    
    // Update customer debt total
    async updateCustomerDebt(customerId, amount, type) {
        const docRef = doc(db, COLLECTIONS.CUSTOMERS, customerId);
        const increment_amount = type === TRANSACTION_TYPES.DEBT ? amount : -amount;
        
        await updateDoc(docRef, {
            totalDebt: increment(increment_amount),
            updatedAt: new Date()
        });
    }
};

// Transaction operations
export const transactionService = {
    // Add new transaction
    async addTransaction(storeId, customerId, transactionData) {
        const user = getCurrentUser();
        if (!user) throw new Error('User not authenticated');
        
        const transaction = {
            ...transactionData,
            storeId: storeId || user.uid,
            customerId,
            createdAt: new Date()
        };
        
        // Use batch to update both transaction and customer debt
        const batch = writeBatch(db);
        
        // Add transaction
        const transactionRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
        batch.set(transactionRef, transaction);
        
        // Update customer debt
        const customerRef = doc(db, COLLECTIONS.CUSTOMERS, customerId);
        const increment_amount = transactionData.type === TRANSACTION_TYPES.DEBT 
            ? transactionData.amount 
            : -transactionData.amount;
        
        batch.update(customerRef, {
            totalDebt: increment(increment_amount),
            updatedAt: new Date()
        });
        
        await batch.commit();
        
        return { id: transactionRef.id, ...transaction };
    },
    
    // Get customer transactions
    async getCustomerTransactions(customerId) {
        const q = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where('customerId', '==', customerId),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },
    
    // Get store transactions
    async getStoreTransactions(storeId = null, limitCount = 50) {
        const user = getCurrentUser();
        const targetStoreId = storeId || user?.uid;
        if (!targetStoreId) throw new Error('Store ID required');
        
        const q = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where('storeId', '==', targetStoreId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },
    
    // Delete transaction
    async deleteTransaction(transactionId, customerId, amount, type) {
        // Use batch to delete transaction and update customer debt
        const batch = writeBatch(db);
        
        // Delete transaction
        const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
        batch.delete(transactionRef);
        
        // Reverse the debt change
        const customerRef = doc(db, COLLECTIONS.CUSTOMERS, customerId);
        const increment_amount = type === TRANSACTION_TYPES.DEBT ? -amount : amount;
        
        batch.update(customerRef, {
            totalDebt: increment(increment_amount),
            updatedAt: new Date()
        });
        
        await batch.commit();
    }
};

// Statistics operations
export const statsService = {
    // Get store statistics
    async getStoreStats(storeId = null) {
        const user = getCurrentUser();
        const targetStoreId = storeId || user?.uid;
        if (!targetStoreId) throw new Error('Store ID required');
        
        try {
            // Get customers
            const customers = await customerService.getCustomers(targetStoreId);
            
            // Get transactions
            const transactions = await transactionService.getStoreTransactions(targetStoreId);
            
            // Calculate statistics
            const totalCustomers = customers.length;
            const customersWithDebt = customers.filter(c => c.totalDebt > 0).length;
            const totalDebt = customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
            
            const totalDebts = transactions
                .filter(t => t.type === TRANSACTION_TYPES.DEBT)
                .reduce((sum, t) => sum + t.amount, 0);
            
            const totalPayments = transactions
                .filter(t => t.type === TRANSACTION_TYPES.PAYMENT)
                .reduce((sum, t) => sum + t.amount, 0);
            
            const totalTransactions = transactions.length;
            
            return {
                totalCustomers,
                customersWithDebt,
                totalDebt,
                totalDebts,
                totalPayments,
                totalTransactions
            };
        } catch (error) {
            console.error('Error getting store stats:', error);
            return {
                totalCustomers: 0,
                customersWithDebt: 0,
                totalDebt: 0,
                totalDebts: 0,
                totalPayments: 0,
                totalTransactions: 0
            };
        }
    }
};

// Real-time listeners
export const realtimeService = {
    // Listen to customers changes
    listenToCustomers(storeId, callback) {
        const user = getCurrentUser();
        const targetStoreId = storeId || user?.uid;
        if (!targetStoreId) return null;
        
        const q = query(
            collection(db, COLLECTIONS.CUSTOMERS),
            where('storeId', '==', targetStoreId),
            orderBy('createdAt', 'desc')
        );
        
        return onSnapshot(q, (querySnapshot) => {
            const customers = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(customers);
        });
    },
    
    // Listen to transactions changes
    listenToTransactions(storeId, callback, limitCount = 50) {
        const user = getCurrentUser();
        const targetStoreId = storeId || user?.uid;
        if (!targetStoreId) return null;
        
        const q = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where('storeId', '==', targetStoreId),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        
        return onSnapshot(q, (querySnapshot) => {
            const transactions = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(transactions);
        });
    }
};

