import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  medicinesTable,
  patientsTable,
  salesTransactionsTable,
  salesTransactionItemsTable
} from '../db/schema';
import {
  getDashboardStats,
  getTodayRevenue,
  getMonthlyRevenue,
  generateSalesReport,
  generateStockReport
} from '../handlers/dashboard_handlers';
import { type ReportPeriodInput } from '../schema';

describe('Dashboard Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getDashboardStats', () => {
    it('should return correct dashboard statistics', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const expiredDate = new Date(today);
      expiredDate.setDate(expiredDate.getDate() - 5);

      // Create test data
      // Medicine 1: Normal stock, not expired
      await db.insert(medicinesTable).values({
        name: 'Medicine 1',
        unit: 'tablet',
        price: '10.00',
        minimum_stock: 10,
        current_stock: 20,
        expiry_date: '2025-12-31',
        description: null,
        batch_number: null,
        supplier: null
      });

      // Medicine 2: Low stock, expired
      await db.insert(medicinesTable).values({
        name: 'Medicine 2',
        unit: 'tablet',
        price: '15.00',
        minimum_stock: 20,
        current_stock: 15,
        expiry_date: expiredDate.toISOString().split('T')[0],
        description: null,
        batch_number: null,
        supplier: null
      });

      // Create patient
      const patientResult = await db.insert(patientsTable).values({
        name: 'Test Patient',
        birth_date: null,
        gender: null,
        phone: null,
        address: null,
        medical_history: null
      }).returning();

      // Create today's transaction
      const todayTransactionResult = await db.insert(salesTransactionsTable).values({
        patient_id: patientResult[0].id,
        total_amount: '50.00',
        payment_method: 'CASH',
        payment_received: '50.00',
        change_amount: '0.00',
        status: 'COMPLETED',
        notes: null,
        transaction_date: today
      }).returning();

      // Create yesterday's transaction (shouldn't count in today's stats)
      await db.insert(salesTransactionsTable).values({
        patient_id: null,
        total_amount: '30.00',
        payment_method: 'CASH',
        payment_received: '30.00',
        change_amount: '0.00',
        status: 'COMPLETED',
        notes: null,
        transaction_date: yesterday
      }).returning();

      const stats = await getDashboardStats();

      expect(stats.total_medicines).toBe(2);
      expect(stats.low_stock_medicines).toBe(1); // Medicine 2 has low stock
      expect(stats.expired_medicines).toBe(1); // Medicine 2 is expired
      expect(stats.total_patients).toBe(1);
      expect(stats.today_sales).toBe(50.00);
      expect(stats.today_transactions).toBe(1);
      expect(stats.total_revenue).toBe(80.00); // Both transactions
    });

    it('should handle empty database correctly', async () => {
      const stats = await getDashboardStats();

      expect(stats.total_medicines).toBe(0);
      expect(stats.low_stock_medicines).toBe(0);
      expect(stats.expired_medicines).toBe(0);
      expect(stats.total_patients).toBe(0);
      expect(stats.today_sales).toBe(0);
      expect(stats.today_transactions).toBe(0);
      expect(stats.total_revenue).toBe(0);
    });

    it('should not count cancelled transactions', async () => {
      // Create cancelled transaction
      await db.insert(salesTransactionsTable).values({
        patient_id: null,
        total_amount: '100.00',
        payment_method: 'CASH',
        payment_received: '100.00',
        change_amount: '0.00',
        status: 'CANCELLED',
        notes: null,
        transaction_date: new Date()
      });

      const stats = await getDashboardStats();

      expect(stats.today_sales).toBe(0);
      expect(stats.today_transactions).toBe(0);
      expect(stats.total_revenue).toBe(0);
    });
  });

  describe('getTodayRevenue', () => {
    it('should calculate today revenue correctly', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create today's transactions
      await db.insert(salesTransactionsTable).values([
        {
          patient_id: null,
          total_amount: '25.50',
          payment_method: 'CASH',
          payment_received: '30.00',
          change_amount: '4.50',
          status: 'COMPLETED',
          notes: null,
          transaction_date: today
        },
        {
          patient_id: null,
          total_amount: '15.75',
          payment_method: 'DEBIT',
          payment_received: '15.75',
          change_amount: '0.00',
          status: 'COMPLETED',
          notes: null,
          transaction_date: today
        }
      ]);

      // Create yesterday's transaction (shouldn't count)
      await db.insert(salesTransactionsTable).values({
        patient_id: null,
        total_amount: '100.00',
        payment_method: 'CASH',
        payment_received: '100.00',
        change_amount: '0.00',
        status: 'COMPLETED',
        notes: null,
        transaction_date: yesterday
      });

      const todayRevenue = await getTodayRevenue();

      expect(todayRevenue).toBe(41.25); // 25.50 + 15.75
    });

    it('should return 0 when no transactions today', async () => {
      const todayRevenue = await getTodayRevenue();
      expect(todayRevenue).toBe(0);
    });
  });

  describe('getMonthlyRevenue', () => {
    it('should calculate monthly revenue correctly', async () => {
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 15);
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

      // Create current month transactions
      await db.insert(salesTransactionsTable).values([
        {
          patient_id: null,
          total_amount: '45.00',
          payment_method: 'CASH',
          payment_received: '45.00',
          change_amount: '0.00',
          status: 'COMPLETED',
          notes: null,
          transaction_date: currentMonth
        },
        {
          patient_id: null,
          total_amount: '22.50',
          payment_method: 'CREDIT',
          payment_received: '22.50',
          change_amount: '0.00',
          status: 'COMPLETED',
          notes: null,
          transaction_date: currentMonth
        }
      ]);

      // Create previous month transaction (shouldn't count)
      await db.insert(salesTransactionsTable).values({
        patient_id: null,
        total_amount: '100.00',
        payment_method: 'CASH',
        payment_received: '100.00',
        change_amount: '0.00',
        status: 'COMPLETED',
        notes: null,
        transaction_date: previousMonth
      });

      const monthlyRevenue = await getMonthlyRevenue();

      expect(monthlyRevenue).toBe(67.50); // 45.00 + 22.50
    });

    it('should return 0 when no transactions this month', async () => {
      const monthlyRevenue = await getMonthlyRevenue();
      expect(monthlyRevenue).toBe(0);
    });
  });

  describe('generateSalesReport', () => {
    it('should generate comprehensive sales report', async () => {
      // Create patient
      const patientResult = await db.insert(patientsTable).values({
        name: 'John Doe',
        birth_date: '1990-01-01',
        gender: 'L',
        phone: '123456789',
        address: 'Test Address',
        medical_history: null
      }).returning();

      const reportStart = new Date('2024-01-01');
      const reportEnd = new Date('2024-01-31');
      const transactionDate = new Date('2024-01-15');

      // Create transactions within report period
      await db.insert(salesTransactionsTable).values([
        {
          patient_id: patientResult[0].id,
          total_amount: '75.50',
          payment_method: 'CASH',
          payment_received: '80.00',
          change_amount: '4.50',
          status: 'COMPLETED',
          notes: 'Regular checkup',
          transaction_date: transactionDate
        },
        {
          patient_id: null,
          total_amount: '42.25',
          payment_method: 'DEBIT',
          payment_received: '42.25',
          change_amount: '0.00',
          status: 'COMPLETED',
          notes: null,
          transaction_date: transactionDate
        }
      ]);

      // Create transaction outside report period (shouldn't be included)
      await db.insert(salesTransactionsTable).values({
        patient_id: null,
        total_amount: '100.00',
        payment_method: 'CASH',
        payment_received: '100.00',
        change_amount: '0.00',
        status: 'COMPLETED',
        notes: null,
        transaction_date: new Date('2023-12-31')
      });

      const input: ReportPeriodInput = {
        start_date: reportStart,
        end_date: reportEnd
      };

      const report = await generateSalesReport(input);

      expect(report.period).toBe('2024-01-01 to 2024-01-31');
      expect(report.total_transactions).toBe(2);
      expect(report.total_revenue).toBe(117.75); // 75.50 + 42.25
      expect(report.transactions).toHaveLength(2);

      // Check transaction details
      const patientTransaction = report.transactions.find(t => t.patient_id === patientResult[0].id);
      expect(patientTransaction).toBeDefined();
      expect(patientTransaction!.patient_name).toBe('John Doe');
      expect(patientTransaction!.total_amount).toBe(75.50);
      expect(patientTransaction!.payment_method).toBe('CASH');

      const walkInTransaction = report.transactions.find(t => t.patient_id === null);
      expect(walkInTransaction).toBeDefined();
      expect(walkInTransaction!.patient_name).toBeNull();
      expect(walkInTransaction!.total_amount).toBe(42.25);
      expect(walkInTransaction!.payment_method).toBe('DEBIT');
    });

    it('should handle empty period correctly', async () => {
      const input: ReportPeriodInput = {
        start_date: new Date('2024-06-01'),
        end_date: new Date('2024-06-30')
      };

      const report = await generateSalesReport(input);

      expect(report.period).toBe('2024-06-01 to 2024-06-30');
      expect(report.total_transactions).toBe(0);
      expect(report.total_revenue).toBe(0);
      expect(report.transactions).toHaveLength(0);
    });
  });

  describe('generateStockReport', () => {
    it('should generate comprehensive stock report', async () => {
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 30);
      
      const expiredDate = new Date(today);
      expiredDate.setDate(expiredDate.getDate() - 5);

      // Create medicines with different stock conditions
      await db.insert(medicinesTable).values([
        {
          name: 'Normal Medicine',
          description: 'Normal stock and not expired',
          unit: 'tablet',
          price: '12.50',
          minimum_stock: 10,
          current_stock: 50,
          expiry_date: futureDate.toISOString().split('T')[0],
          batch_number: 'BATCH001',
          supplier: 'Supplier A'
        },
        {
          name: 'Low Stock Medicine',
          description: 'Below minimum stock',
          unit: 'bottle',
          price: '25.75',
          minimum_stock: 20,
          current_stock: 15,
          expiry_date: futureDate.toISOString().split('T')[0],
          batch_number: 'BATCH002',
          supplier: 'Supplier B'
        },
        {
          name: 'Expired Medicine',
          description: 'Past expiry date',
          unit: 'strip',
          price: '8.90',
          minimum_stock: 5,
          current_stock: 30,
          expiry_date: expiredDate.toISOString().split('T')[0],
          batch_number: 'BATCH003',
          supplier: 'Supplier C'
        },
        {
          name: 'Low Stock & Expired',
          description: 'Both low stock and expired',
          unit: 'tablet',
          price: '15.00',
          minimum_stock: 25,
          current_stock: 10,
          expiry_date: expiredDate.toISOString().split('T')[0],
          batch_number: 'BATCH004',
          supplier: 'Supplier D'
        }
      ]);

      const input: ReportPeriodInput = {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const report = await generateStockReport(input);

      expect(report.period).toBe('2024-01-01 to 2024-12-31');
      expect(report.total_medicines).toBe(4);
      expect(report.low_stock_count).toBe(2); // Low Stock Medicine and Low Stock & Expired
      expect(report.expired_count).toBe(2); // Expired Medicine and Low Stock & Expired
      expect(report.medicines).toHaveLength(4);

      // Verify medicine data with proper numeric conversion
      const normalMedicine = report.medicines.find(m => m.name === 'Normal Medicine');
      expect(normalMedicine).toBeDefined();
      expect(typeof normalMedicine!.price).toBe('number');
      expect(normalMedicine!.price).toBe(12.50);
      expect(normalMedicine!.current_stock).toBe(50);
      expect(normalMedicine!.minimum_stock).toBe(10);

      const lowStockMedicine = report.medicines.find(m => m.name === 'Low Stock Medicine');
      expect(lowStockMedicine).toBeDefined();
      expect(lowStockMedicine!.current_stock).toBe(15);
      expect(lowStockMedicine!.minimum_stock).toBe(20);
      expect(lowStockMedicine!.current_stock <= lowStockMedicine!.minimum_stock).toBe(true);
    });

    it('should handle empty medicine inventory', async () => {
      const input: ReportPeriodInput = {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const report = await generateStockReport(input);

      expect(report.period).toBe('2024-01-01 to 2024-12-31');
      expect(report.total_medicines).toBe(0);
      expect(report.low_stock_count).toBe(0);
      expect(report.expired_count).toBe(0);
      expect(report.medicines).toHaveLength(0);
    });

    it('should handle medicines without expiry dates', async () => {
      await db.insert(medicinesTable).values({
        name: 'No Expiry Medicine',
        description: null,
        unit: 'tablet',
        price: '10.00',
        minimum_stock: 15,
        current_stock: 25,
        expiry_date: null,
        batch_number: null,
        supplier: null
      });

      const input: ReportPeriodInput = {
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31')
      };

      const report = await generateStockReport(input);

      expect(report.total_medicines).toBe(1);
      expect(report.expired_count).toBe(0); // Medicines without expiry date are not counted as expired
      expect(report.medicines[0].expiry_date).toBeNull();
    });
  });
});