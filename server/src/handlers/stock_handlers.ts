import { db } from '../db';
import { medicinesTable, stockTransactionsTable } from '../db/schema';
import { 
  type StockTransaction, 
  type CreateStockTransactionInput 
} from '../schema';
import { eq, desc, and, gte, lte, SQL } from 'drizzle-orm';

export const createStockTransaction = async (input: CreateStockTransactionInput): Promise<StockTransaction> => {
  try {
    // 1. Validate that medicine exists and get current stock
    const medicine = await db.select()
      .from(medicinesTable)
      .where(eq(medicinesTable.id, input.medicine_id))
      .execute();

    if (medicine.length === 0) {
      throw new Error(`Medicine with ID ${input.medicine_id} not found`);
    }

    const currentMedicine = medicine[0];

    // 2. For OUT transactions, check if sufficient stock is available
    if (input.type === 'OUT' && currentMedicine.current_stock < input.quantity) {
      throw new Error(`Insufficient stock. Available: ${currentMedicine.current_stock}, Required: ${input.quantity}`);
    }

    // 3. Insert stock transaction record
    const stockTransactionResult = await db.insert(stockTransactionsTable)
      .values({
        medicine_id: input.medicine_id,
        type: input.type,
        quantity: input.quantity,
        notes: input.notes,
        transaction_date: new Date()
      })
      .returning()
      .execute();

    // 4. Update current_stock in medicines table
    const stockChange = input.type === 'IN' ? input.quantity : -input.quantity;
    const newStock = currentMedicine.current_stock + stockChange;

    await db.update(medicinesTable)
      .set({ 
        current_stock: newStock,
        updated_at: new Date()
      })
      .where(eq(medicinesTable.id, input.medicine_id))
      .execute();

    // 5. Return the created transaction
    const createdTransaction = stockTransactionResult[0];
    return {
      ...createdTransaction,
      // Convert timestamp to Date object for consistency
      transaction_date: createdTransaction.transaction_date,
      created_at: createdTransaction.created_at
    };
  } catch (error) {
    console.error('Stock transaction creation failed:', error);
    throw error;
  }
};

export const getStockTransactions = async (): Promise<StockTransaction[]> => {
  try {
    const transactions = await db.select()
      .from(stockTransactionsTable)
      .orderBy(desc(stockTransactionsTable.transaction_date))
      .execute();

    return transactions.map(transaction => ({
      ...transaction,
      transaction_date: transaction.transaction_date,
      created_at: transaction.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch stock transactions:', error);
    throw error;
  }
};

export const getStockTransactionsByMedicine = async (medicineId: number): Promise<StockTransaction[]> => {
  try {
    const transactions = await db.select()
      .from(stockTransactionsTable)
      .where(eq(stockTransactionsTable.medicine_id, medicineId))
      .orderBy(desc(stockTransactionsTable.transaction_date))
      .execute();

    return transactions.map(transaction => ({
      ...transaction,
      transaction_date: transaction.transaction_date,
      created_at: transaction.created_at
    }));
  } catch (error) {
    console.error(`Failed to fetch stock transactions for medicine ${medicineId}:`, error);
    throw error;
  }
};

export const getStockTransactionHistory = async (startDate: Date, endDate: Date): Promise<StockTransaction[]> => {
  try {
    const conditions: SQL<unknown>[] = [];
    
    // Add date range conditions
    conditions.push(gte(stockTransactionsTable.transaction_date, startDate));
    conditions.push(lte(stockTransactionsTable.transaction_date, endDate));

    const transactions = await db.select()
      .from(stockTransactionsTable)
      .where(and(...conditions))
      .orderBy(desc(stockTransactionsTable.transaction_date))
      .execute();

    return transactions.map(transaction => ({
      ...transaction,
      transaction_date: transaction.transaction_date,
      created_at: transaction.created_at
    }));
  } catch (error) {
    console.error('Failed to fetch stock transaction history:', error);
    throw error;
  }
};