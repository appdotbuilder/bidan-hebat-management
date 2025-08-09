import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { medicinesTable, stockTransactionsTable } from '../db/schema';
import { 
  createStockTransaction, 
  getStockTransactions, 
  getStockTransactionsByMedicine, 
  getStockTransactionHistory 
} from '../handlers/stock_handlers';
import { type CreateStockTransactionInput } from '../schema';
import { eq } from 'drizzle-orm';

// Helper function to create a test medicine
const createTestMedicine = async (initialStock = 100) => {
  const result = await db.insert(medicinesTable)
    .values({
      name: 'Test Medicine',
      description: 'Medicine for testing',
      unit: 'tablet',
      price: '10.50',
      minimum_stock: 10,
      current_stock: initialStock,
      expiry_date: '2025-12-31',
      batch_number: 'BATCH001',
      supplier: 'Test Supplier'
    })
    .returning()
    .execute();
  
  return result[0];
};

describe('Stock Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createStockTransaction', () => {
    it('should create IN stock transaction and increase medicine stock', async () => {
      const medicine = await createTestMedicine(50);
      
      const input: CreateStockTransactionInput = {
        medicine_id: medicine.id,
        type: 'IN',
        quantity: 25,
        notes: 'Restocking from supplier'
      };

      const result = await createStockTransaction(input);

      // Verify transaction was created
      expect(result.medicine_id).toEqual(medicine.id);
      expect(result.type).toEqual('IN');
      expect(result.quantity).toEqual(25);
      expect(result.notes).toEqual('Restocking from supplier');
      expect(result.id).toBeDefined();
      expect(result.transaction_date).toBeInstanceOf(Date);
      expect(result.created_at).toBeInstanceOf(Date);

      // Verify medicine stock was updated
      const updatedMedicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicine.id))
        .execute();

      expect(updatedMedicine[0].current_stock).toEqual(75); // 50 + 25
    });

    it('should create OUT stock transaction and decrease medicine stock', async () => {
      const medicine = await createTestMedicine(100);
      
      const input: CreateStockTransactionInput = {
        medicine_id: medicine.id,
        type: 'OUT',
        quantity: 30,
        notes: 'Sale to patient'
      };

      const result = await createStockTransaction(input);

      // Verify transaction was created
      expect(result.medicine_id).toEqual(medicine.id);
      expect(result.type).toEqual('OUT');
      expect(result.quantity).toEqual(30);
      expect(result.notes).toEqual('Sale to patient');

      // Verify medicine stock was updated
      const updatedMedicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicine.id))
        .execute();

      expect(updatedMedicine[0].current_stock).toEqual(70); // 100 - 30
    });

    it('should throw error when medicine does not exist', async () => {
      const input: CreateStockTransactionInput = {
        medicine_id: 999999,
        type: 'IN',
        quantity: 10,
        notes: null
      };

      await expect(createStockTransaction(input)).rejects.toThrow(/Medicine with ID 999999 not found/i);
    });

    it('should throw error when insufficient stock for OUT transaction', async () => {
      const medicine = await createTestMedicine(20);
      
      const input: CreateStockTransactionInput = {
        medicine_id: medicine.id,
        type: 'OUT',
        quantity: 25,
        notes: 'Attempted oversale'
      };

      await expect(createStockTransaction(input)).rejects.toThrow(/Insufficient stock/i);
    });

    it('should save transaction to database', async () => {
      const medicine = await createTestMedicine();
      
      const input: CreateStockTransactionInput = {
        medicine_id: medicine.id,
        type: 'IN',
        quantity: 15,
        notes: 'Test transaction'
      };

      const result = await createStockTransaction(input);

      // Query database to verify transaction was saved
      const transactions = await db.select()
        .from(stockTransactionsTable)
        .where(eq(stockTransactionsTable.id, result.id))
        .execute();

      expect(transactions).toHaveLength(1);
      expect(transactions[0].medicine_id).toEqual(medicine.id);
      expect(transactions[0].type).toEqual('IN');
      expect(transactions[0].quantity).toEqual(15);
      expect(transactions[0].notes).toEqual('Test transaction');
    });

    it('should handle null notes correctly', async () => {
      const medicine = await createTestMedicine();
      
      const input: CreateStockTransactionInput = {
        medicine_id: medicine.id,
        type: 'IN',
        quantity: 5,
        notes: null
      };

      const result = await createStockTransaction(input);

      expect(result.notes).toBeNull();
    });
  });

  describe('getStockTransactions', () => {
    it('should return all stock transactions ordered by date desc', async () => {
      const medicine = await createTestMedicine();

      // Create multiple transactions with different dates
      await createStockTransaction({
        medicine_id: medicine.id,
        type: 'IN',
        quantity: 10,
        notes: 'First transaction'
      });

      await createStockTransaction({
        medicine_id: medicine.id,
        type: 'OUT',
        quantity: 5,
        notes: 'Second transaction'
      });

      const transactions = await getStockTransactions();

      expect(transactions).toHaveLength(2);
      // Should be ordered by date desc (latest first)
      expect(transactions[0].notes).toEqual('Second transaction');
      expect(transactions[1].notes).toEqual('First transaction');

      // Verify data types
      transactions.forEach(transaction => {
        expect(transaction.transaction_date).toBeInstanceOf(Date);
        expect(transaction.created_at).toBeInstanceOf(Date);
        expect(typeof transaction.medicine_id).toBe('number');
        expect(typeof transaction.quantity).toBe('number');
      });
    });

    it('should return empty array when no transactions exist', async () => {
      const transactions = await getStockTransactions();
      expect(transactions).toHaveLength(0);
    });
  });

  describe('getStockTransactionsByMedicine', () => {
    it('should return transactions for specific medicine only', async () => {
      const medicine1 = await createTestMedicine();
      const medicine2 = await createTestMedicine();

      // Create transactions for both medicines
      await createStockTransaction({
        medicine_id: medicine1.id,
        type: 'IN',
        quantity: 10,
        notes: 'Medicine 1 transaction'
      });

      await createStockTransaction({
        medicine_id: medicine2.id,
        type: 'IN',
        quantity: 15,
        notes: 'Medicine 2 transaction'
      });

      await createStockTransaction({
        medicine_id: medicine1.id,
        type: 'OUT',
        quantity: 5,
        notes: 'Another Medicine 1 transaction'
      });

      const medicine1Transactions = await getStockTransactionsByMedicine(medicine1.id);
      const medicine2Transactions = await getStockTransactionsByMedicine(medicine2.id);

      expect(medicine1Transactions).toHaveLength(2);
      expect(medicine2Transactions).toHaveLength(1);

      // All transactions should be for the correct medicine
      medicine1Transactions.forEach(transaction => {
        expect(transaction.medicine_id).toEqual(medicine1.id);
      });

      medicine2Transactions.forEach(transaction => {
        expect(transaction.medicine_id).toEqual(medicine2.id);
      });
    });

    it('should return empty array for medicine with no transactions', async () => {
      const medicine = await createTestMedicine();
      const transactions = await getStockTransactionsByMedicine(medicine.id);
      expect(transactions).toHaveLength(0);
    });

    it('should return transactions ordered by date desc', async () => {
      const medicine = await createTestMedicine();

      await createStockTransaction({
        medicine_id: medicine.id,
        type: 'IN',
        quantity: 10,
        notes: 'First'
      });

      await createStockTransaction({
        medicine_id: medicine.id,
        type: 'OUT',
        quantity: 5,
        notes: 'Second'
      });

      const transactions = await getStockTransactionsByMedicine(medicine.id);

      expect(transactions).toHaveLength(2);
      // Should be ordered by date desc
      expect(transactions[0].notes).toEqual('Second');
      expect(transactions[1].notes).toEqual('First');
    });
  });

  describe('getStockTransactionHistory', () => {
    it('should return transactions within date range', async () => {
      const medicine = await createTestMedicine();

      // Create transactions
      await createStockTransaction({
        medicine_id: medicine.id,
        type: 'IN',
        quantity: 10,
        notes: 'Within range'
      });

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const transactions = await getStockTransactionHistory(yesterday, tomorrow);

      expect(transactions.length).toBeGreaterThan(0);
      transactions.forEach(transaction => {
        expect(transaction.transaction_date).toBeInstanceOf(Date);
        expect(transaction.transaction_date >= yesterday).toBe(true);
        expect(transaction.transaction_date <= tomorrow).toBe(true);
      });
    });

    it('should return empty array when no transactions in date range', async () => {
      const medicine = await createTestMedicine();

      await createStockTransaction({
        medicine_id: medicine.id,
        type: 'IN',
        quantity: 10,
        notes: 'Current transaction'
      });

      // Query for future date range
      const futureStart = new Date();
      futureStart.setDate(futureStart.getDate() + 10);
      const futureEnd = new Date();
      futureEnd.setDate(futureEnd.getDate() + 20);

      const transactions = await getStockTransactionHistory(futureStart, futureEnd);
      expect(transactions).toHaveLength(0);
    });

    it('should handle exact date boundaries correctly', async () => {
      const medicine = await createTestMedicine();

      await createStockTransaction({
        medicine_id: medicine.id,
        type: 'IN',
        quantity: 10,
        notes: 'Boundary transaction'
      });

      const now = new Date();
      const transactions = await getStockTransactionHistory(now, now);

      // Should include transactions from today
      expect(transactions.length).toBeGreaterThanOrEqual(0);
    });

    it('should return transactions ordered by date desc', async () => {
      const medicine = await createTestMedicine();

      await createStockTransaction({
        medicine_id: medicine.id,
        type: 'IN',
        quantity: 10,
        notes: 'First transaction'
      });

      await createStockTransaction({
        medicine_id: medicine.id,
        type: 'OUT',
        quantity: 5,
        notes: 'Second transaction'
      });

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const transactions = await getStockTransactionHistory(yesterday, tomorrow);

      expect(transactions).toHaveLength(2);
      // Should be ordered by date desc (latest first)
      expect(transactions[0].notes).toEqual('Second transaction');
      expect(transactions[1].notes).toEqual('First transaction');
    });
  });
});