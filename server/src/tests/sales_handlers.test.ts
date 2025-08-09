import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  medicinesTable, 
  patientsTable, 
  salesTransactionsTable,
  salesTransactionItemsTable,
  stockTransactionsTable,
  settingsTable
} from '../db/schema';
import { 
  type CreateSalesTransactionInput,
  type SalesTransaction
} from '../schema';
import {
  createSalesTransaction,
  getSalesTransactions,
  getSalesTransactionById,
  getSalesTransactionsByDateRange,
  getTodaySalesTransactions,
  getReceiptData,
  cancelSalesTransaction
} from '../handlers/sales_handlers';
import { eq } from 'drizzle-orm';

// Test data
const testMedicine1 = {
  name: 'Paracetamol',
  description: 'Pain reliever',
  unit: 'tablet',
  price: '5000.00',
  minimum_stock: 10,
  current_stock: 100,
  expiry_date: '2025-12-31',
  batch_number: 'B001',
  supplier: 'PT Supplier A'
};

const testMedicine2 = {
  name: 'Amoxicillin',
  description: 'Antibiotic',
  unit: 'capsule',
  price: '3000.00',
  minimum_stock: 5,
  current_stock: 50,
  expiry_date: '2025-06-30',
  batch_number: 'B002',
  supplier: 'PT Supplier B'
};

const testPatient = {
  name: 'John Doe',
  birth_date: '1990-01-01',
  gender: 'L' as const,
  phone: '081234567890',
  address: 'Jakarta',
  medical_history: 'No allergies'
};

const testTransactionInput: CreateSalesTransactionInput = {
  patient_id: null, // Will be set in tests
  payment_method: 'CASH',
  payment_received: 20000,
  notes: 'Test transaction',
  items: [
    {
      medicine_id: 0, // Will be set in tests
      quantity: 2
    },
    {
      medicine_id: 0, // Will be set in tests
      quantity: 1
    }
  ]
};

describe('Sales Handlers', () => {
  let medicine1Id: number;
  let medicine2Id: number;
  let patientId: number;

  beforeEach(async () => {
    await createDB();

    // Create test medicines
    const medicine1Result = await db.insert(medicinesTable)
      .values(testMedicine1)
      .returning()
      .execute();
    medicine1Id = medicine1Result[0].id;

    const medicine2Result = await db.insert(medicinesTable)
      .values(testMedicine2)
      .returning()
      .execute();
    medicine2Id = medicine2Result[0].id;

    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values(testPatient)
      .returning()
      .execute();
    patientId = patientResult[0].id;

    // Create clinic settings
    await db.insert(settingsTable)
      .values([
        { key: 'clinic_name', value: 'Test Clinic', description: 'Clinic name' },
        { key: 'clinic_address', value: 'Test Address', description: 'Clinic address' }
      ])
      .execute();
  });

  afterEach(resetDB);

  describe('createSalesTransaction', () => {
    it('should create a sales transaction with items', async () => {
      const input = {
        ...testTransactionInput,
        patient_id: patientId,
        items: [
          { medicine_id: medicine1Id, quantity: 2 },
          { medicine_id: medicine2Id, quantity: 1 }
        ]
      };

      const result = await createSalesTransaction(input);

      // Verify transaction properties
      expect(result.id).toBeDefined();
      expect(result.patient_id).toEqual(patientId);
      expect(result.total_amount).toEqual(13000); // (5000 * 2) + (3000 * 1)
      expect(result.payment_method).toEqual('CASH');
      expect(result.payment_received).toEqual(20000);
      expect(result.change_amount).toEqual(7000);
      expect(result.status).toEqual('COMPLETED');
      expect(result.notes).toEqual('Test transaction');
      expect(typeof result.total_amount).toEqual('number');
      expect(typeof result.payment_received).toEqual('number');
      expect(typeof result.change_amount).toEqual('number');

      // Verify transaction items were created
      const items = await db.select()
        .from(salesTransactionItemsTable)
        .where(eq(salesTransactionItemsTable.transaction_id, result.id))
        .execute();

      expect(items).toHaveLength(2);
      expect(items[0].medicine_id).toEqual(medicine1Id);
      expect(items[0].quantity).toEqual(2);
      expect(parseFloat(items[0].unit_price)).toEqual(5000);
      expect(parseFloat(items[0].total_price)).toEqual(10000);

      expect(items[1].medicine_id).toEqual(medicine2Id);
      expect(items[1].quantity).toEqual(1);
      expect(parseFloat(items[1].unit_price)).toEqual(3000);
      expect(parseFloat(items[1].total_price)).toEqual(3000);
    });

    it('should update medicine stock after transaction', async () => {
      const input = {
        ...testTransactionInput,
        payment_received: 50000, // Ensure sufficient payment: (5000*5) + (3000*3) = 34000
        items: [
          { medicine_id: medicine1Id, quantity: 5 },
          { medicine_id: medicine2Id, quantity: 3 }
        ]
      };

      await createSalesTransaction(input);

      // Check updated stock
      const medicine1 = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicine1Id))
        .execute();

      const medicine2 = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicine2Id))
        .execute();

      expect(medicine1[0].current_stock).toEqual(95); // 100 - 5
      expect(medicine2[0].current_stock).toEqual(47); // 50 - 3
    });

    it('should create stock OUT transactions', async () => {
      const input = {
        ...testTransactionInput,
        items: [
          { medicine_id: medicine1Id, quantity: 2 }
        ]
      };

      const transaction = await createSalesTransaction(input);

      // Check stock transaction was created
      const stockTransactions = await db.select()
        .from(stockTransactionsTable)
        .where(eq(stockTransactionsTable.medicine_id, medicine1Id))
        .execute();

      expect(stockTransactions).toHaveLength(1);
      expect(stockTransactions[0].type).toEqual('OUT');
      expect(stockTransactions[0].quantity).toEqual(2);
      expect(stockTransactions[0].notes).toContain(`Sales transaction #${transaction.id}`);
    });

    it('should handle walk-in customers (no patient)', async () => {
      const input = {
        ...testTransactionInput,
        patient_id: null,
        items: [
          { medicine_id: medicine1Id, quantity: 1 }
        ]
      };

      const result = await createSalesTransaction(input);

      expect(result.patient_id).toBeNull();
      expect(result.total_amount).toEqual(5000);
      expect(result.status).toEqual('COMPLETED');
    });

    it('should throw error for non-existent medicine', async () => {
      const input = {
        ...testTransactionInput,
        items: [
          { medicine_id: 99999, quantity: 1 }
        ]
      };

      await expect(createSalesTransaction(input)).rejects.toThrow(/Medicine with ID 99999 not found/);
    });

    it('should throw error for insufficient stock', async () => {
      const input = {
        ...testTransactionInput,
        items: [
          { medicine_id: medicine1Id, quantity: 200 } // More than available stock
        ]
      };

      await expect(createSalesTransaction(input)).rejects.toThrow(/Insufficient stock for Paracetamol/);
    });

    it('should throw error when payment is insufficient', async () => {
      const input = {
        ...testTransactionInput,
        payment_received: 1000, // Less than total amount
        items: [
          { medicine_id: medicine1Id, quantity: 1 } // 5000 total
        ]
      };

      await expect(createSalesTransaction(input)).rejects.toThrow(/Payment received is less than total amount/);
    });
  });

  describe('getSalesTransactions', () => {
    it('should return all transactions ordered by date DESC', async () => {
      // Create multiple transactions
      const input1 = {
        ...testTransactionInput,
        items: [{ medicine_id: medicine1Id, quantity: 1 }]
      };

      const input2 = {
        ...testTransactionInput,
        items: [{ medicine_id: medicine2Id, quantity: 1 }]
      };

      const transaction1 = await createSalesTransaction(input1);
      const transaction2 = await createSalesTransaction(input2);

      const results = await getSalesTransactions();

      expect(results).toHaveLength(2);
      // Should be ordered by transaction_date DESC (newest first)
      expect(results[0].id).toEqual(transaction2.id);
      expect(results[1].id).toEqual(transaction1.id);
      expect(typeof results[0].total_amount).toEqual('number');
    });

    it('should return empty array when no transactions exist', async () => {
      const results = await getSalesTransactions();
      expect(results).toHaveLength(0);
    });
  });

  describe('getSalesTransactionById', () => {
    it('should return transaction by ID', async () => {
      const input = {
        ...testTransactionInput,
        items: [{ medicine_id: medicine1Id, quantity: 2 }]
      };

      const transaction = await createSalesTransaction(input);
      const result = await getSalesTransactionById(transaction.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(transaction.id);
      expect(result!.total_amount).toEqual(10000);
      expect(typeof result!.total_amount).toEqual('number');
    });

    it('should return null for non-existent transaction', async () => {
      const result = await getSalesTransactionById(99999);
      expect(result).toBeNull();
    });
  });

  describe('getSalesTransactionsByDateRange', () => {
    it('should return transactions within date range', async () => {
      const input = {
        ...testTransactionInput,
        items: [{ medicine_id: medicine1Id, quantity: 1 }]
      };

      await createSalesTransaction(input);

      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const results = await getSalesTransactionsByDateRange(yesterday, tomorrow);

      expect(results).toHaveLength(1);
      expect(typeof results[0].total_amount).toEqual('number');
    });

    it('should return empty array when no transactions in range', async () => {
      const pastDate1 = new Date('2020-01-01');
      const pastDate2 = new Date('2020-01-02');

      const results = await getSalesTransactionsByDateRange(pastDate1, pastDate2);
      expect(results).toHaveLength(0);
    });
  });

  describe('getTodaySalesTransactions', () => {
    it('should return today transactions', async () => {
      const input = {
        ...testTransactionInput,
        items: [{ medicine_id: medicine1Id, quantity: 1 }]
      };

      await createSalesTransaction(input);

      const results = await getTodaySalesTransactions();

      expect(results).toHaveLength(1);
      expect(typeof results[0].total_amount).toEqual('number');
    });
  });

  describe('getReceiptData', () => {
    it('should return complete receipt data', async () => {
      const input = {
        ...testTransactionInput,
        patient_id: patientId,
        items: [
          { medicine_id: medicine1Id, quantity: 2 },
          { medicine_id: medicine2Id, quantity: 1 }
        ]
      };

      const transaction = await createSalesTransaction(input);
      const receipt = await getReceiptData(transaction.id);

      expect(receipt).not.toBeNull();
      expect(receipt!.transaction.id).toEqual(transaction.id);
      expect(receipt!.transaction.total_amount).toEqual(13000);
      expect(typeof receipt!.transaction.total_amount).toEqual('number');

      expect(receipt!.items).toHaveLength(2);
      expect(receipt!.items[0].medicine_name).toEqual('Paracetamol');
      expect(receipt!.items[0].medicine_unit).toEqual('tablet');
      expect(receipt!.items[0].quantity).toEqual(2);
      expect(typeof receipt!.items[0].unit_price).toEqual('number');

      expect(receipt!.patient).not.toBeNull();
      expect(receipt!.patient!.name).toEqual('John Doe');

      expect(receipt!.clinic_name).toEqual('Test Clinic');
      expect(receipt!.clinic_address).toEqual('Test Address');
    });

    it('should return receipt data for walk-in customer', async () => {
      const input = {
        ...testTransactionInput,
        patient_id: null,
        items: [{ medicine_id: medicine1Id, quantity: 1 }]
      };

      const transaction = await createSalesTransaction(input);
      const receipt = await getReceiptData(transaction.id);

      expect(receipt).not.toBeNull();
      expect(receipt!.patient).toBeNull();
      expect(receipt!.clinic_name).toEqual('Test Clinic');
    });

    it('should return null for non-existent transaction', async () => {
      const receipt = await getReceiptData(99999);
      expect(receipt).toBeNull();
    });

    it('should use default clinic name when settings not found', async () => {
      // Remove clinic settings
      await db.delete(settingsTable).execute();

      const input = {
        ...testTransactionInput,
        items: [{ medicine_id: medicine1Id, quantity: 1 }]
      };

      const transaction = await createSalesTransaction(input);
      const receipt = await getReceiptData(transaction.id);

      expect(receipt!.clinic_name).toEqual('Apotek');
      expect(receipt!.clinic_address).toBeNull();
    });
  });

  describe('cancelSalesTransaction', () => {
    it('should cancel transaction and restore stock', async () => {
      const input = {
        ...testTransactionInput,
        payment_received: 50000, // Ensure sufficient payment: (5000*5) + (3000*3) = 34000
        items: [
          { medicine_id: medicine1Id, quantity: 5 },
          { medicine_id: medicine2Id, quantity: 3 }
        ]
      };

      const transaction = await createSalesTransaction(input);

      // Verify stock was reduced
      const medicine1Before = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicine1Id))
        .execute();
      expect(medicine1Before[0].current_stock).toEqual(95);

      // Cancel transaction
      const result = await cancelSalesTransaction(transaction.id);
      expect(result).toBe(true);

      // Verify transaction status updated
      const cancelledTransaction = await db.select()
        .from(salesTransactionsTable)
        .where(eq(salesTransactionsTable.id, transaction.id))
        .execute();
      expect(cancelledTransaction[0].status).toEqual('CANCELLED');

      // Verify stock was restored
      const medicine1After = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicine1Id))
        .execute();
      expect(medicine1After[0].current_stock).toEqual(100); // Restored

      // Verify stock IN transactions were created
      const stockTransactions = await db.select()
        .from(stockTransactionsTable)
        .where(eq(stockTransactionsTable.medicine_id, medicine1Id))
        .execute();

      const inTransaction = stockTransactions.find(st => st.type === 'IN');
      expect(inTransaction).toBeDefined();
      expect(inTransaction!.quantity).toEqual(5);
      expect(inTransaction!.notes).toContain(`Cancelled sales transaction #${transaction.id}`);
    });

    it('should return false for non-existent transaction', async () => {
      const result = await cancelSalesTransaction(99999);
      expect(result).toBe(false);
    });

    it('should return false for already cancelled transaction', async () => {
      const input = {
        ...testTransactionInput,
        items: [{ medicine_id: medicine1Id, quantity: 1 }]
      };

      const transaction = await createSalesTransaction(input);

      // Cancel first time
      const result1 = await cancelSalesTransaction(transaction.id);
      expect(result1).toBe(true);

      // Try to cancel again
      const result2 = await cancelSalesTransaction(transaction.id);
      expect(result2).toBe(false);
    });
  });
});