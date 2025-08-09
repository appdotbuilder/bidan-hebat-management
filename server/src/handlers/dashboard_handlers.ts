import { db } from '../db';
import { 
  medicinesTable,
  patientsTable,
  salesTransactionsTable,
  salesTransactionItemsTable
} from '../db/schema';
import { 
  type DashboardStats,
  type SalesReport,
  type StockReport,
  type ReportPeriodInput
} from '../schema';
import { count, sql, eq, lte, gte, and, between } from 'drizzle-orm';

export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999); // End of today

    // Get total medicines count
    const totalMedicinesResult = await db
      .select({ count: count() })
      .from(medicinesTable)
      .execute();

    // Get low stock medicines count (current_stock <= minimum_stock)
    const lowStockResult = await db
      .select({ count: count() })
      .from(medicinesTable)
      .where(sql`${medicinesTable.current_stock} <= ${medicinesTable.minimum_stock}`)
      .execute();

    // Get expired medicines count
    const todayString = today.toISOString().split('T')[0];
    const expiredResult = await db
      .select({ count: count() })
      .from(medicinesTable)
      .where(lte(medicinesTable.expiry_date, todayString))
      .execute();

    // Get total patients count
    const totalPatientsResult = await db
      .select({ count: count() })
      .from(patientsTable)
      .execute();

    // Get today's sales amount
    const todayRevenueResult = await db
      .select({ 
        total: sql<string>`COALESCE(SUM(${salesTransactionsTable.total_amount}), 0)` 
      })
      .from(salesTransactionsTable)
      .where(
        and(
          between(salesTransactionsTable.transaction_date, today, endOfToday),
          eq(salesTransactionsTable.status, 'COMPLETED')
        )
      )
      .execute();

    // Get today's transaction count
    const todayTransactionsResult = await db
      .select({ count: count() })
      .from(salesTransactionsTable)
      .where(
        and(
          between(salesTransactionsTable.transaction_date, today, endOfToday),
          eq(salesTransactionsTable.status, 'COMPLETED')
        )
      )
      .execute();

    // Get total revenue (all time)
    const totalRevenueResult = await db
      .select({ 
        total: sql<string>`COALESCE(SUM(${salesTransactionsTable.total_amount}), 0)` 
      })
      .from(salesTransactionsTable)
      .where(eq(salesTransactionsTable.status, 'COMPLETED'))
      .execute();

    return {
      total_medicines: totalMedicinesResult[0]?.count || 0,
      low_stock_medicines: lowStockResult[0]?.count || 0,
      expired_medicines: expiredResult[0]?.count || 0,
      total_patients: totalPatientsResult[0]?.count || 0,
      today_sales: parseFloat(todayRevenueResult[0]?.total || '0'),
      today_transactions: todayTransactionsResult[0]?.count || 0,
      total_revenue: parseFloat(totalRevenueResult[0]?.total || '0')
    };
  } catch (error) {
    console.error('Dashboard stats fetching failed:', error);
    throw error;
  }
};

export const getTodayRevenue = async (): Promise<number> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const result = await db
      .select({ 
        total: sql<string>`COALESCE(SUM(${salesTransactionsTable.total_amount}), 0)` 
      })
      .from(salesTransactionsTable)
      .where(
        and(
          between(salesTransactionsTable.transaction_date, today, endOfToday),
          eq(salesTransactionsTable.status, 'COMPLETED')
        )
      )
      .execute();

    return parseFloat(result[0]?.total || '0');
  } catch (error) {
    console.error('Today revenue calculation failed:', error);
    throw error;
  }
};

export const getMonthlyRevenue = async (): Promise<number> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const result = await db
      .select({ 
        total: sql<string>`COALESCE(SUM(${salesTransactionsTable.total_amount}), 0)` 
      })
      .from(salesTransactionsTable)
      .where(
        and(
          between(salesTransactionsTable.transaction_date, startOfMonth, endOfMonth),
          eq(salesTransactionsTable.status, 'COMPLETED')
        )
      )
      .execute();

    return parseFloat(result[0]?.total || '0');
  } catch (error) {
    console.error('Monthly revenue calculation failed:', error);
    throw error;
  }
};

export const generateSalesReport = async (input: ReportPeriodInput): Promise<SalesReport> => {
  try {
    const startDate = new Date(input.start_date);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(input.end_date);
    endDate.setHours(23, 59, 59, 999);

    // Get transactions with patient data
    const transactionsResult = await db
      .select({
        id: salesTransactionsTable.id,
        patient_id: salesTransactionsTable.patient_id,
        total_amount: salesTransactionsTable.total_amount,
        payment_method: salesTransactionsTable.payment_method,
        payment_received: salesTransactionsTable.payment_received,
        change_amount: salesTransactionsTable.change_amount,
        status: salesTransactionsTable.status,
        notes: salesTransactionsTable.notes,
        transaction_date: salesTransactionsTable.transaction_date,
        created_at: salesTransactionsTable.created_at,
        patient_name: patientsTable.name
      })
      .from(salesTransactionsTable)
      .leftJoin(patientsTable, eq(salesTransactionsTable.patient_id, patientsTable.id))
      .where(
        and(
          between(salesTransactionsTable.transaction_date, startDate, endDate),
          eq(salesTransactionsTable.status, 'COMPLETED')
        )
      )
      .execute();

    // Calculate totals
    const totalTransactions = transactionsResult.length;
    const totalRevenue = transactionsResult.reduce((sum, transaction) => 
      sum + parseFloat(transaction.total_amount), 0
    );

    // Convert transactions with proper typing
    const transactions = transactionsResult.map(transaction => ({
      id: transaction.id,
      patient_id: transaction.patient_id,
      total_amount: parseFloat(transaction.total_amount),
      payment_method: transaction.payment_method,
      payment_received: parseFloat(transaction.payment_received),
      change_amount: parseFloat(transaction.change_amount),
      status: transaction.status,
      notes: transaction.notes,
      transaction_date: transaction.transaction_date,
      created_at: transaction.created_at,
      patient_name: transaction.patient_name
    }));

    return {
      period: `${input.start_date.toISOString().split('T')[0]} to ${input.end_date.toISOString().split('T')[0]}`,
      total_transactions: totalTransactions,
      total_revenue: totalRevenue,
      transactions
    };
  } catch (error) {
    console.error('Sales report generation failed:', error);
    throw error;
  }
};

export const generateStockReport = async (input: ReportPeriodInput): Promise<StockReport> => {
  try {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];

    // Get all medicines
    const medicinesResult = await db
      .select()
      .from(medicinesTable)
      .execute();

    // Convert medicines with proper numeric types
    const medicines = medicinesResult.map(medicine => ({
      ...medicine,
      price: parseFloat(medicine.price),
      expiry_date: medicine.expiry_date ? new Date(medicine.expiry_date) : null
    }));

    // Count low stock medicines
    const lowStockCount = medicines.filter(medicine => 
      medicine.current_stock <= medicine.minimum_stock
    ).length;

    // Count expired medicines
    const expiredCount = medicines.filter(medicine => 
      medicine.expiry_date && medicine.expiry_date <= today
    ).length;

    return {
      period: `${input.start_date.toISOString().split('T')[0]} to ${input.end_date.toISOString().split('T')[0]}`,
      total_medicines: medicines.length,
      low_stock_count: lowStockCount,
      expired_count: expiredCount,
      medicines
    };
  } catch (error) {
    console.error('Stock report generation failed:', error);
    throw error;
  }
};