import { db } from '../db';
import { patientsTable, salesTransactionsTable, salesTransactionItemsTable, medicinesTable } from '../db/schema';
import { 
  type Patient, 
  type CreatePatientInput, 
  type UpdatePatientInput,
  type SearchPatientInput,
  type PatientVisit
} from '../schema';
import { eq, asc, desc, or, ilike } from 'drizzle-orm';

export const createPatient = async (input: CreatePatientInput): Promise<Patient> => {
  try {
    const result = await db.insert(patientsTable)
      .values({
        name: input.name,
        birth_date: input.birth_date ? input.birth_date.toISOString().split('T')[0] : null,
        gender: input.gender,
        phone: input.phone,
        address: input.address,
        medical_history: input.medical_history
      })
      .returning()
      .execute();

    // Convert date string back to Date object
    const patient = result[0];
    return {
      ...patient,
      birth_date: patient.birth_date ? new Date(patient.birth_date) : null
    };
  } catch (error) {
    console.error('Patient creation failed:', error);
    throw error;
  }
};

export const getPatients = async (): Promise<Patient[]> => {
  try {
    const result = await db.select()
      .from(patientsTable)
      .orderBy(asc(patientsTable.name))
      .execute();

    // Convert date strings back to Date objects
    return result.map(patient => ({
      ...patient,
      birth_date: patient.birth_date ? new Date(patient.birth_date) : null
    }));
  } catch (error) {
    console.error('Failed to fetch patients:', error);
    throw error;
  }
};

export const getPatientById = async (id: number): Promise<Patient | null> => {
  try {
    const result = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, id))
      .execute();

    if (result.length === 0) return null;

    const patient = result[0];
    return {
      ...patient,
      birth_date: patient.birth_date ? new Date(patient.birth_date) : null
    };
  } catch (error) {
    console.error('Failed to fetch patient by ID:', error);
    throw error;
  }
};

export const updatePatient = async (input: UpdatePatientInput): Promise<Patient | null> => {
  try {
    // Build update object dynamically based on provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.birth_date !== undefined) {
      updateData.birth_date = input.birth_date ? input.birth_date.toISOString().split('T')[0] : null;
    }
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.medical_history !== undefined) updateData.medical_history = input.medical_history;

    const result = await db.update(patientsTable)
      .set(updateData)
      .where(eq(patientsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) return null;

    const patient = result[0];
    return {
      ...patient,
      birth_date: patient.birth_date ? new Date(patient.birth_date) : null
    };
  } catch (error) {
    console.error('Patient update failed:', error);
    throw error;
  }
};

export const deletePatient = async (id: number): Promise<boolean> => {
  try {
    // Check if patient has any sales transactions
    const transactions = await db.select()
      .from(salesTransactionsTable)
      .where(eq(salesTransactionsTable.patient_id, id))
      .execute();

    if (transactions.length > 0) {
      throw new Error('Cannot delete patient with existing sales transactions');
    }

    const result = await db.delete(patientsTable)
      .where(eq(patientsTable.id, id))
      .execute();

    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('Patient deletion failed:', error);
    throw error;
  }
};

export const searchPatients = async (input: SearchPatientInput): Promise<Patient[]> => {
  try {
    let result;
    
    if (input.query && input.query.trim() !== '') {
      const searchTerm = `%${input.query.trim()}%`;
      result = await db.select()
        .from(patientsTable)
        .where(
          or(
            ilike(patientsTable.name, searchTerm),
            ilike(patientsTable.phone, searchTerm),
            ilike(patientsTable.address, searchTerm)
          )
        )
        .orderBy(asc(patientsTable.name))
        .execute();
    } else {
      result = await db.select()
        .from(patientsTable)
        .orderBy(asc(patientsTable.name))
        .execute();
    }
    
    // Convert date strings back to Date objects
    return result.map(patient => ({
      ...patient,
      birth_date: patient.birth_date ? new Date(patient.birth_date) : null
    }));
  } catch (error) {
    console.error('Patient search failed:', error);
    throw error;
  }
};

export const getPatientVisitHistory = async (patientId: number): Promise<PatientVisit[]> => {
  try {
    // Get all sales transactions for the patient with items
    const transactionsWithItems = await db.select({
      transaction_id: salesTransactionsTable.id,
      transaction_date: salesTransactionsTable.transaction_date,
      total_amount: salesTransactionsTable.total_amount,
      medicine_name: medicinesTable.name,
      quantity: salesTransactionItemsTable.quantity,
      unit_price: salesTransactionItemsTable.unit_price,
      total_price: salesTransactionItemsTable.total_price
    })
      .from(salesTransactionsTable)
      .innerJoin(
        salesTransactionItemsTable,
        eq(salesTransactionsTable.id, salesTransactionItemsTable.transaction_id)
      )
      .innerJoin(
        medicinesTable,
        eq(salesTransactionItemsTable.medicine_id, medicinesTable.id)
      )
      .where(eq(salesTransactionsTable.patient_id, patientId))
      .orderBy(desc(salesTransactionsTable.transaction_date))
      .execute();

    // Group items by transaction
    const transactionMap = new Map<number, PatientVisit>();

    transactionsWithItems.forEach(row => {
      const transactionId = row.transaction_id;
      
      if (!transactionMap.has(transactionId)) {
        transactionMap.set(transactionId, {
          transaction_id: transactionId,
          transaction_date: row.transaction_date,
          total_amount: parseFloat(row.total_amount),
          items: []
        });
      }

      const transaction = transactionMap.get(transactionId)!;
      transaction.items.push({
        medicine_name: row.medicine_name,
        quantity: row.quantity,
        unit_price: parseFloat(row.unit_price),
        total_price: parseFloat(row.total_price)
      });
    });

    return Array.from(transactionMap.values());
  } catch (error) {
    console.error('Failed to fetch patient visit history:', error);
    throw error;
  }
};