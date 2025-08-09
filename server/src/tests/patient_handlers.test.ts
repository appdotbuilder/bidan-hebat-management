import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { patientsTable, medicinesTable, salesTransactionsTable, salesTransactionItemsTable } from '../db/schema';
import { 
  type CreatePatientInput, 
  type UpdatePatientInput, 
  type SearchPatientInput 
} from '../schema';
import { 
  createPatient, 
  getPatients, 
  getPatientById, 
  updatePatient, 
  deletePatient, 
  searchPatients, 
  getPatientVisitHistory 
} from '../handlers/patient_handlers';
import { eq } from 'drizzle-orm';

// Test data
const testPatientInput: CreatePatientInput = {
  name: 'John Doe',
  birth_date: new Date('1985-05-15'),
  gender: 'L',
  phone: '081234567890',
  address: 'Jl. Test No. 123, Jakarta',
  medical_history: 'No known allergies'
};

const testPatientInput2: CreatePatientInput = {
  name: 'Jane Smith',
  birth_date: new Date('1990-08-20'),
  gender: 'P',
  phone: '081987654321',
  address: 'Jl. Sample No. 456, Bandung',
  medical_history: 'Diabetes mellitus'
};

describe('Patient Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createPatient', () => {
    it('should create a patient with all fields', async () => {
      const result = await createPatient(testPatientInput);

      expect(result.name).toEqual('John Doe');
      expect(result.birth_date).toEqual(new Date('1985-05-15'));
      expect(result.gender).toEqual('L');
      expect(result.phone).toEqual('081234567890');
      expect(result.address).toEqual('Jl. Test No. 123, Jakarta');
      expect(result.medical_history).toEqual('No known allergies');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a patient with minimal fields', async () => {
      const minimalInput: CreatePatientInput = {
        name: 'Minimal Patient',
        birth_date: null,
        gender: null,
        phone: null,
        address: null,
        medical_history: null
      };

      const result = await createPatient(minimalInput);

      expect(result.name).toEqual('Minimal Patient');
      expect(result.birth_date).toBeNull();
      expect(result.gender).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.address).toBeNull();
      expect(result.medical_history).toBeNull();
      expect(result.id).toBeDefined();
    });

    it('should save patient to database', async () => {
      const result = await createPatient(testPatientInput);

      const patients = await db.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, result.id))
        .execute();

      expect(patients).toHaveLength(1);
      expect(patients[0].name).toEqual('John Doe');
      expect(patients[0].phone).toEqual('081234567890');
    });
  });

  describe('getPatients', () => {
    it('should return empty array when no patients exist', async () => {
      const result = await getPatients();
      expect(result).toEqual([]);
    });

    it('should return all patients ordered by name', async () => {
      await createPatient(testPatientInput2); // Jane Smith
      await createPatient(testPatientInput); // John Doe

      const result = await getPatients();

      expect(result).toHaveLength(2);
      // Should be ordered by name: Jane Smith, then John Doe
      expect(result[0].name).toEqual('Jane Smith');
      expect(result[1].name).toEqual('John Doe');
    });

    it('should return patients with all fields', async () => {
      await createPatient(testPatientInput);

      const result = await getPatients();

      expect(result).toHaveLength(1);
      const patient = result[0];
      expect(patient.name).toEqual('John Doe');
      expect(patient.birth_date).toEqual(new Date('1985-05-15'));
      expect(patient.gender).toEqual('L');
      expect(patient.phone).toEqual('081234567890');
      expect(patient.address).toEqual('Jl. Test No. 123, Jakarta');
      expect(patient.medical_history).toEqual('No known allergies');
    });
  });

  describe('getPatientById', () => {
    it('should return null for non-existent patient', async () => {
      const result = await getPatientById(999);
      expect(result).toBeNull();
    });

    it('should return patient when found', async () => {
      const created = await createPatient(testPatientInput);

      const result = await getPatientById(created.id);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('John Doe');
      expect(result!.id).toEqual(created.id);
    });
  });

  describe('updatePatient', () => {
    it('should update patient with partial data', async () => {
      const created = await createPatient(testPatientInput);

      const updateInput: UpdatePatientInput = {
        id: created.id,
        name: 'John Updated',
        phone: '081999888777'
      };

      const result = await updatePatient(updateInput);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('John Updated');
      expect(result!.phone).toEqual('081999888777');
      expect(result!.address).toEqual('Jl. Test No. 123, Jakarta'); // Unchanged
      expect(result!.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should update patient with all fields', async () => {
      const created = await createPatient(testPatientInput);

      const updateInput: UpdatePatientInput = {
        id: created.id,
        name: 'Complete Update',
        birth_date: new Date('1980-01-01'),
        gender: 'P',
        phone: '081111222333',
        address: 'New Address 789',
        medical_history: 'Updated medical history'
      };

      const result = await updatePatient(updateInput);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Complete Update');
      expect(result!.birth_date).toEqual(new Date('1980-01-01'));
      expect(result!.gender).toEqual('P');
      expect(result!.phone).toEqual('081111222333');
      expect(result!.address).toEqual('New Address 789');
      expect(result!.medical_history).toEqual('Updated medical history');
    });

    it('should return null for non-existent patient', async () => {
      const updateInput: UpdatePatientInput = {
        id: 999,
        name: 'Non-existent'
      };

      const result = await updatePatient(updateInput);
      expect(result).toBeNull();
    });

    it('should save changes to database', async () => {
      const created = await createPatient(testPatientInput);

      await updatePatient({
        id: created.id,
        name: 'Database Test'
      });

      const fromDb = await db.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, created.id))
        .execute();

      expect(fromDb[0].name).toEqual('Database Test');
    });
  });

  describe('deletePatient', () => {
    it('should delete patient successfully', async () => {
      const created = await createPatient(testPatientInput);

      const result = await deletePatient(created.id);

      expect(result).toBe(true);

      const fromDb = await getPatientById(created.id);
      expect(fromDb).toBeNull();
    });

    it('should return false for non-existent patient', async () => {
      const result = await deletePatient(999);
      expect(result).toBe(false);
    });

    it('should prevent deletion when patient has sales transactions', async () => {
      const patient = await createPatient(testPatientInput);

      // Create a medicine first
      const medicine = await db.insert(medicinesTable)
        .values({
          name: 'Test Medicine',
          unit: 'tablet',
          price: '10.00',
          minimum_stock: 10,
          current_stock: 100
        })
        .returning()
        .execute();

      // Create a sales transaction
      const transaction = await db.insert(salesTransactionsTable)
        .values({
          patient_id: patient.id,
          total_amount: '50.00',
          payment_method: 'CASH',
          payment_received: '50.00',
          change_amount: '0.00',
          status: 'COMPLETED'
        })
        .returning()
        .execute();

      // Create transaction item
      await db.insert(salesTransactionItemsTable)
        .values({
          transaction_id: transaction[0].id,
          medicine_id: medicine[0].id,
          quantity: 5,
          unit_price: '10.00',
          total_price: '50.00'
        })
        .execute();

      await expect(deletePatient(patient.id))
        .rejects
        .toThrow(/Cannot delete patient with existing sales transactions/);
    });
  });

  describe('searchPatients', () => {
    beforeEach(async () => {
      await createPatient(testPatientInput); // John Doe
      await createPatient(testPatientInput2); // Jane Smith
      await createPatient({
        name: 'Bob Johnson',
        birth_date: null,
        gender: null,
        phone: '081555666777',
        address: 'Jl. Bob Street, Surabaya',
        medical_history: null
      });
    });

    it('should return all patients when no search query', async () => {
      const searchInput: SearchPatientInput = {};

      const result = await searchPatients(searchInput);

      expect(result).toHaveLength(3);
      // Should be ordered by name
      expect(result[0].name).toEqual('Bob Johnson');
      expect(result[1].name).toEqual('Jane Smith');
      expect(result[2].name).toEqual('John Doe');
    });

    it('should search by name (case-insensitive)', async () => {
      const searchInput: SearchPatientInput = {
        query: 'john'
      };

      const result = await searchPatients(searchInput);

      expect(result).toHaveLength(2);
      expect(result.some(p => p.name === 'John Doe')).toBe(true);
      expect(result.some(p => p.name === 'Bob Johnson')).toBe(true);
    });

    it('should search by phone number', async () => {
      const searchInput: SearchPatientInput = {
        query: '081234567890'
      };

      const result = await searchPatients(searchInput);

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('John Doe');
    });

    it('should search by address', async () => {
      const searchInput: SearchPatientInput = {
        query: 'bandung'
      };

      const result = await searchPatients(searchInput);

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Jane Smith');
    });

    it('should return empty array for non-matching search', async () => {
      const searchInput: SearchPatientInput = {
        query: 'nonexistent'
      };

      const result = await searchPatients(searchInput);
      expect(result).toHaveLength(0);
    });

    it('should handle empty string search query', async () => {
      const searchInput: SearchPatientInput = {
        query: '   '
      };

      const result = await searchPatients(searchInput);
      expect(result).toHaveLength(3); // Should return all patients
    });
  });

  describe('getPatientVisitHistory', () => {
    it('should return empty array for patient with no visits', async () => {
      const patient = await createPatient(testPatientInput);

      const result = await getPatientVisitHistory(patient.id);
      expect(result).toEqual([]);
    });

    it('should return visit history with transaction details', async () => {
      const patient = await createPatient(testPatientInput);

      // Create medicines
      const medicine1 = await db.insert(medicinesTable)
        .values({
          name: 'Paracetamol',
          unit: 'tablet',
          price: '5.00',
          minimum_stock: 10,
          current_stock: 100
        })
        .returning()
        .execute();

      const medicine2 = await db.insert(medicinesTable)
        .values({
          name: 'Vitamin C',
          unit: 'tablet',
          price: '3.00',
          minimum_stock: 5,
          current_stock: 50
        })
        .returning()
        .execute();

      // Create sales transaction
      const transaction = await db.insert(salesTransactionsTable)
        .values({
          patient_id: patient.id,
          total_amount: '19.00',
          payment_method: 'CASH',
          payment_received: '20.00',
          change_amount: '1.00',
          status: 'COMPLETED',
          transaction_date: new Date('2024-01-15')
        })
        .returning()
        .execute();

      // Create transaction items
      await db.insert(salesTransactionItemsTable)
        .values([
          {
            transaction_id: transaction[0].id,
            medicine_id: medicine1[0].id,
            quantity: 2,
            unit_price: '5.00',
            total_price: '10.00'
          },
          {
            transaction_id: transaction[0].id,
            medicine_id: medicine2[0].id,
            quantity: 3,
            unit_price: '3.00',
            total_price: '9.00'
          }
        ])
        .execute();

      const result = await getPatientVisitHistory(patient.id);

      expect(result).toHaveLength(1);
      const visit = result[0];
      expect(visit.transaction_id).toEqual(transaction[0].id);
      expect(visit.transaction_date).toEqual(new Date('2024-01-15'));
      expect(visit.total_amount).toEqual(19.00);
      expect(visit.items).toHaveLength(2);

      // Check items
      const paracetamolItem = visit.items.find(item => item.medicine_name === 'Paracetamol');
      expect(paracetamolItem).toBeDefined();
      expect(paracetamolItem!.quantity).toEqual(2);
      expect(paracetamolItem!.unit_price).toEqual(5.00);
      expect(paracetamolItem!.total_price).toEqual(10.00);

      const vitaminItem = visit.items.find(item => item.medicine_name === 'Vitamin C');
      expect(vitaminItem).toBeDefined();
      expect(vitaminItem!.quantity).toEqual(3);
      expect(vitaminItem!.unit_price).toEqual(3.00);
      expect(vitaminItem!.total_price).toEqual(9.00);
    });

    it('should return multiple visits ordered by date (newest first)', async () => {
      const patient = await createPatient(testPatientInput);

      const medicine = await db.insert(medicinesTable)
        .values({
          name: 'Test Medicine',
          unit: 'tablet',
          price: '10.00',
          minimum_stock: 10,
          current_stock: 100
        })
        .returning()
        .execute();

      // Create first transaction (older)
      const transaction1 = await db.insert(salesTransactionsTable)
        .values({
          patient_id: patient.id,
          total_amount: '10.00',
          payment_method: 'CASH',
          payment_received: '10.00',
          change_amount: '0.00',
          status: 'COMPLETED',
          transaction_date: new Date('2024-01-10')
        })
        .returning()
        .execute();

      // Create second transaction (newer)
      const transaction2 = await db.insert(salesTransactionsTable)
        .values({
          patient_id: patient.id,
          total_amount: '20.00',
          payment_method: 'CASH',
          payment_received: '20.00',
          change_amount: '0.00',
          status: 'COMPLETED',
          transaction_date: new Date('2024-01-20')
        })
        .returning()
        .execute();

      // Create items for both transactions
      await db.insert(salesTransactionItemsTable)
        .values([
          {
            transaction_id: transaction1[0].id,
            medicine_id: medicine[0].id,
            quantity: 1,
            unit_price: '10.00',
            total_price: '10.00'
          },
          {
            transaction_id: transaction2[0].id,
            medicine_id: medicine[0].id,
            quantity: 2,
            unit_price: '10.00',
            total_price: '20.00'
          }
        ])
        .execute();

      const result = await getPatientVisitHistory(patient.id);

      expect(result).toHaveLength(2);
      // Should be ordered by date (newest first)
      expect(result[0].transaction_date).toEqual(new Date('2024-01-20'));
      expect(result[0].total_amount).toEqual(20.00);
      expect(result[1].transaction_date).toEqual(new Date('2024-01-10'));
      expect(result[1].total_amount).toEqual(10.00);
    });

    it('should handle numeric conversions correctly', async () => {
      const patient = await createPatient(testPatientInput);

      const medicine = await db.insert(medicinesTable)
        .values({
          name: 'Expensive Medicine',
          unit: 'bottle',
          price: '199.99',
          minimum_stock: 1,
          current_stock: 10
        })
        .returning()
        .execute();

      const transaction = await db.insert(salesTransactionsTable)
        .values({
          patient_id: patient.id,
          total_amount: '399.98',
          payment_method: 'CREDIT',
          payment_received: '399.98',
          change_amount: '0.00',
          status: 'COMPLETED'
        })
        .returning()
        .execute();

      await db.insert(salesTransactionItemsTable)
        .values({
          transaction_id: transaction[0].id,
          medicine_id: medicine[0].id,
          quantity: 2,
          unit_price: '199.99',
          total_price: '399.98'
        })
        .execute();

      const result = await getPatientVisitHistory(patient.id);

      expect(result).toHaveLength(1);
      const visit = result[0];
      expect(typeof visit.total_amount).toBe('number');
      expect(visit.total_amount).toEqual(399.98);
      expect(typeof visit.items[0].unit_price).toBe('number');
      expect(visit.items[0].unit_price).toEqual(199.99);
      expect(typeof visit.items[0].total_price).toBe('number');
      expect(visit.items[0].total_price).toEqual(399.98);
    });
  });
});