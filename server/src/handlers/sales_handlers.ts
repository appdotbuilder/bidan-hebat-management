import { db } from '../db';
import { 
  salesTransactionsTable, 
  salesTransactionItemsTable,
  medicinesTable,
  patientsTable,
  stockTransactionsTable,
  settingsTable
} from '../db/schema';
import { 
  type SalesTransaction, 
  type CreateSalesTransactionInput,
  type ReceiptData
} from '../schema';
import { eq, gte, lte, and, desc, SQL } from 'drizzle-orm';

export const createSalesTransaction = async (input: CreateSalesTransactionInput): Promise<SalesTransaction> => {
  try {
    // Validate medicines and check stock
    const medicineData = [];
    for (const item of input.items) {
      const medicine = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, item.medicine_id))
        .execute();

      if (medicine.length === 0) {
        throw new Error(`Medicine with ID ${item.medicine_id} not found`);
      }

      const medicineRecord = medicine[0];
      if (medicineRecord.current_stock < item.quantity) {
        throw new Error(`Insufficient stock for ${medicineRecord.name}. Available: ${medicineRecord.current_stock}, Requested: ${item.quantity}`);
      }

      medicineData.push({
        ...medicineRecord,
        requestedQuantity: item.quantity
      });
    }

    // Calculate total amount
    let totalAmount = 0;
    const itemsWithPrices = medicineData.map(med => {
      const totalPrice = parseFloat(med.price) * med.requestedQuantity;
      totalAmount += totalPrice;
      return {
        medicine_id: med.id,
        quantity: med.requestedQuantity,
        unit_price: parseFloat(med.price),
        total_price: totalPrice
      };
    });

    // Calculate change
    const changeAmount = input.payment_received - totalAmount;
    if (changeAmount < 0) {
      throw new Error('Payment received is less than total amount');
    }

    // Create sales transaction
    const transactionResult = await db.insert(salesTransactionsTable)
      .values({
        patient_id: input.patient_id,
        total_amount: totalAmount.toString(),
        payment_method: input.payment_method,
        payment_received: input.payment_received.toString(),
        change_amount: changeAmount.toString(),
        status: 'COMPLETED',
        notes: input.notes
      })
      .returning()
      .execute();

    const transaction = transactionResult[0];

    // Create transaction items
    for (const item of itemsWithPrices) {
      await db.insert(salesTransactionItemsTable)
        .values({
          transaction_id: transaction.id,
          medicine_id: item.medicine_id,
          quantity: item.quantity,
          unit_price: item.unit_price.toString(),
          total_price: item.total_price.toString()
        })
        .execute();
    }

    // Update medicine stock and create stock transactions
    for (const med of medicineData) {
      // Update stock
      await db.update(medicinesTable)
        .set({
          current_stock: med.current_stock - med.requestedQuantity,
          updated_at: new Date()
        })
        .where(eq(medicinesTable.id, med.id))
        .execute();

      // Create stock OUT transaction
      await db.insert(stockTransactionsTable)
        .values({
          medicine_id: med.id,
          type: 'OUT',
          quantity: med.requestedQuantity,
          notes: `Sales transaction #${transaction.id}`
        })
        .execute();
    }

    // Return transaction with converted numeric fields
    return {
      ...transaction,
      total_amount: parseFloat(transaction.total_amount),
      payment_received: parseFloat(transaction.payment_received),
      change_amount: parseFloat(transaction.change_amount)
    };
  } catch (error) {
    console.error('Sales transaction creation failed:', error);
    throw error;
  }
};

export const getSalesTransactions = async (): Promise<SalesTransaction[]> => {
  try {
    const results = await db.select()
      .from(salesTransactionsTable)
      .orderBy(desc(salesTransactionsTable.transaction_date))
      .execute();

    return results.map(transaction => ({
      ...transaction,
      total_amount: parseFloat(transaction.total_amount),
      payment_received: parseFloat(transaction.payment_received),
      change_amount: parseFloat(transaction.change_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch sales transactions:', error);
    throw error;
  }
};

export const getSalesTransactionById = async (id: number): Promise<SalesTransaction | null> => {
  try {
    const results = await db.select()
      .from(salesTransactionsTable)
      .where(eq(salesTransactionsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const transaction = results[0];
    return {
      ...transaction,
      total_amount: parseFloat(transaction.total_amount),
      payment_received: parseFloat(transaction.payment_received),
      change_amount: parseFloat(transaction.change_amount)
    };
  } catch (error) {
    console.error('Failed to fetch sales transaction by ID:', error);
    throw error;
  }
};

export const getSalesTransactionsByDateRange = async (startDate: Date, endDate: Date): Promise<SalesTransaction[]> => {
  try {
    const results = await db.select()
      .from(salesTransactionsTable)
      .where(and(
        gte(salesTransactionsTable.transaction_date, startDate),
        lte(salesTransactionsTable.transaction_date, endDate)
      ))
      .orderBy(desc(salesTransactionsTable.transaction_date))
      .execute();

    return results.map(transaction => ({
      ...transaction,
      total_amount: parseFloat(transaction.total_amount),
      payment_received: parseFloat(transaction.payment_received),
      change_amount: parseFloat(transaction.change_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch sales transactions by date range:', error);
    throw error;
  }
};

export const getTodaySalesTransactions = async (): Promise<SalesTransaction[]> => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    return await getSalesTransactionsByDateRange(startOfDay, endOfDay);
  } catch (error) {
    console.error('Failed to fetch today sales transactions:', error);
    throw error;
  }
};

export const getReceiptData = async (transactionId: number): Promise<ReceiptData | null> => {
  try {
    // Get transaction
    const transactionResults = await db.select()
      .from(salesTransactionsTable)
      .where(eq(salesTransactionsTable.id, transactionId))
      .execute();

    if (transactionResults.length === 0) {
      return null;
    }

    const transaction = transactionResults[0];

    // Get transaction items with medicine details
    const itemResults = await db.select({
      id: salesTransactionItemsTable.id,
      transaction_id: salesTransactionItemsTable.transaction_id,
      medicine_id: salesTransactionItemsTable.medicine_id,
      quantity: salesTransactionItemsTable.quantity,
      unit_price: salesTransactionItemsTable.unit_price,
      total_price: salesTransactionItemsTable.total_price,
      created_at: salesTransactionItemsTable.created_at,
      medicine_name: medicinesTable.name,
      medicine_unit: medicinesTable.unit
    })
      .from(salesTransactionItemsTable)
      .innerJoin(medicinesTable, eq(salesTransactionItemsTable.medicine_id, medicinesTable.id))
      .where(eq(salesTransactionItemsTable.transaction_id, transactionId))
      .execute();

    // Get patient data if available
    let patient = null;
    if (transaction.patient_id) {
      const patientResults = await db.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, transaction.patient_id))
        .execute();

      if (patientResults.length > 0) {
        patient = patientResults[0];
      }
    }

    // Get clinic settings
    const clinicNameResult = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.key, 'clinic_name'))
      .execute();

    const clinicAddressResult = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.key, 'clinic_address'))
      .execute();

    const clinicName = clinicNameResult.length > 0 ? (clinicNameResult[0].value || 'Apotek') : 'Apotek';
    const clinicAddress = clinicAddressResult.length > 0 ? clinicAddressResult[0].value : null;

    // Format items with numeric conversions
    const items = itemResults.map(item => ({
      id: item.id,
      transaction_id: item.transaction_id,
      medicine_id: item.medicine_id,
      quantity: item.quantity,
      unit_price: parseFloat(item.unit_price),
      total_price: parseFloat(item.total_price),
      created_at: item.created_at,
      medicine_name: item.medicine_name,
      medicine_unit: item.medicine_unit
    }));

    return {
      transaction: {
        ...transaction,
        total_amount: parseFloat(transaction.total_amount),
        payment_received: parseFloat(transaction.payment_received),
        change_amount: parseFloat(transaction.change_amount)
      },
      items,
      patient: patient ? {
        ...patient,
        birth_date: patient.birth_date ? new Date(patient.birth_date) : null
      } : null,
      clinic_name: clinicName,
      clinic_address: clinicAddress
    };
  } catch (error) {
    console.error('Failed to fetch receipt data:', error);
    throw error;
  }
};

export const cancelSalesTransaction = async (id: number): Promise<boolean> => {
  try {
    // Check if transaction exists and is not already cancelled
    const transactionResults = await db.select()
      .from(salesTransactionsTable)
      .where(eq(salesTransactionsTable.id, id))
      .execute();

    if (transactionResults.length === 0) {
      return false;
    }

    const transaction = transactionResults[0];
    if (transaction.status === 'CANCELLED') {
      return false; // Already cancelled
    }

    // Get transaction items
    const itemResults = await db.select()
      .from(salesTransactionItemsTable)
      .where(eq(salesTransactionItemsTable.transaction_id, id))
      .execute();

    // Update transaction status
    await db.update(salesTransactionsTable)
      .set({ status: 'CANCELLED' })
      .where(eq(salesTransactionsTable.id, id))
      .execute();

    // Restore medicine stock and create stock IN transactions
    for (const item of itemResults) {
      // Get current medicine data
      const medicineResults = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, item.medicine_id))
        .execute();

      if (medicineResults.length > 0) {
        const medicine = medicineResults[0];

        // Restore stock
        await db.update(medicinesTable)
          .set({
            current_stock: medicine.current_stock + item.quantity,
            updated_at: new Date()
          })
          .where(eq(medicinesTable.id, item.medicine_id))
          .execute();

        // Create stock IN transaction
        await db.insert(stockTransactionsTable)
          .values({
            medicine_id: item.medicine_id,
            type: 'IN',
            quantity: item.quantity,
            notes: `Cancelled sales transaction #${id}`
          })
          .execute();
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to cancel sales transaction:', error);
    throw error;
  }
};