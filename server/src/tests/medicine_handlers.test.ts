import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { medicinesTable } from '../db/schema';
import { type CreateMedicineInput } from '../schema';
import { getMedicines } from '../handlers/medicine_handlers';

// Test medicine data
const testMedicine1: CreateMedicineInput = {
  name: 'Paracetamol',
  description: 'Pain reliever and fever reducer',
  unit: 'tablet',
  price: 2.50,
  minimum_stock: 100,
  current_stock: 500,
  expiry_date: new Date('2025-12-31'),
  batch_number: 'PCT001',
  supplier: 'Pharma Corp'
};

const testMedicine2: CreateMedicineInput = {
  name: 'Amoxicillin',
  description: 'Antibiotic medication',
  unit: 'capsule',
  price: 5.00,
  minimum_stock: 50,
  current_stock: 200,
  expiry_date: new Date('2024-06-30'),
  batch_number: 'AMX002',
  supplier: 'MedSupply Ltd'
};

const testMedicine3: CreateMedicineInput = {
  name: 'Aspirin',
  description: null,
  unit: 'tablet',
  price: 1.75,
  minimum_stock: 75,
  current_stock: 300,
  expiry_date: null,
  batch_number: null,
  supplier: null
};

describe('getMedicines', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no medicines exist', async () => {
    const result = await getMedicines();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all medicines ordered by name', async () => {
    // Create test medicines
    await db.insert(medicinesTable).values([
      {
        name: testMedicine1.name,
        description: testMedicine1.description,
        unit: testMedicine1.unit,
        price: testMedicine1.price.toString(),
        minimum_stock: testMedicine1.minimum_stock,
        current_stock: testMedicine1.current_stock,
        expiry_date: testMedicine1.expiry_date ? testMedicine1.expiry_date.toISOString().split('T')[0] : null,
        batch_number: testMedicine1.batch_number,
        supplier: testMedicine1.supplier
      },
      {
        name: testMedicine2.name,
        description: testMedicine2.description,
        unit: testMedicine2.unit,
        price: testMedicine2.price.toString(),
        minimum_stock: testMedicine2.minimum_stock,
        current_stock: testMedicine2.current_stock,
        expiry_date: testMedicine2.expiry_date ? testMedicine2.expiry_date.toISOString().split('T')[0] : null,
        batch_number: testMedicine2.batch_number,
        supplier: testMedicine2.supplier
      },
      {
        name: testMedicine3.name,
        description: testMedicine3.description,
        unit: testMedicine3.unit,
        price: testMedicine3.price.toString(),
        minimum_stock: testMedicine3.minimum_stock,
        current_stock: testMedicine3.current_stock,
        expiry_date: testMedicine3.expiry_date ? testMedicine3.expiry_date.toISOString().split('T')[0] : null,
        batch_number: testMedicine3.batch_number,
        supplier: testMedicine3.supplier
      }
    ]).execute();

    const result = await getMedicines();

    expect(result).toHaveLength(3);
    expect(Array.isArray(result)).toBe(true);

    // Should be ordered by name alphabetically (Amoxicillin, Aspirin, Paracetamol)
    expect(result[0].name).toEqual('Amoxicillin');
    expect(result[1].name).toEqual('Aspirin');
    expect(result[2].name).toEqual('Paracetamol');
  });

  it('should convert numeric price fields correctly', async () => {
    // Create test medicine
    await db.insert(medicinesTable).values({
      name: testMedicine1.name,
      description: testMedicine1.description,
      unit: testMedicine1.unit,
      price: testMedicine1.price.toString(), // Stored as string
      minimum_stock: testMedicine1.minimum_stock,
      current_stock: testMedicine1.current_stock,
      expiry_date: testMedicine1.expiry_date ? testMedicine1.expiry_date.toISOString().split('T')[0] : null,
      batch_number: testMedicine1.batch_number,
      supplier: testMedicine1.supplier
    }).execute();

    const result = await getMedicines();

    expect(result).toHaveLength(1);
    const medicine = result[0];

    // Verify numeric conversion
    expect(typeof medicine.price).toBe('number');
    expect(medicine.price).toEqual(2.50);
  });

  it('should return all medicine fields correctly', async () => {
    // Create test medicine with all fields
    await db.insert(medicinesTable).values({
      name: testMedicine1.name,
      description: testMedicine1.description,
      unit: testMedicine1.unit,
      price: testMedicine1.price.toString(),
      minimum_stock: testMedicine1.minimum_stock,
      current_stock: testMedicine1.current_stock,
      expiry_date: testMedicine1.expiry_date ? testMedicine1.expiry_date.toISOString().split('T')[0] : null,
      batch_number: testMedicine1.batch_number,
      supplier: testMedicine1.supplier
    }).execute();

    const result = await getMedicines();

    expect(result).toHaveLength(1);
    const medicine = result[0];

    // Verify all fields
    expect(medicine.id).toBeDefined();
    expect(medicine.name).toEqual('Paracetamol');
    expect(medicine.description).toEqual('Pain reliever and fever reducer');
    expect(medicine.unit).toEqual('tablet');
    expect(medicine.price).toEqual(2.50);
    expect(medicine.minimum_stock).toEqual(100);
    expect(medicine.current_stock).toEqual(500);
    expect(medicine.expiry_date).toBeInstanceOf(Date);
    expect(medicine.batch_number).toEqual('PCT001');
    expect(medicine.supplier).toEqual('Pharma Corp');
    expect(medicine.created_at).toBeInstanceOf(Date);
    expect(medicine.updated_at).toBeInstanceOf(Date);
  });

  it('should handle medicines with null fields correctly', async () => {
    // Create test medicine with null fields
    await db.insert(medicinesTable).values({
      name: testMedicine3.name,
      description: testMedicine3.description,
      unit: testMedicine3.unit,
      price: testMedicine3.price.toString(),
      minimum_stock: testMedicine3.minimum_stock,
      current_stock: testMedicine3.current_stock,
      expiry_date: testMedicine3.expiry_date ? testMedicine3.expiry_date.toISOString().split('T')[0] : null,
      batch_number: testMedicine3.batch_number,
      supplier: testMedicine3.supplier
    }).execute();

    const result = await getMedicines();

    expect(result).toHaveLength(1);
    const medicine = result[0];

    // Verify null fields
    expect(medicine.name).toEqual('Aspirin');
    expect(medicine.description).toBeNull();
    expect(medicine.expiry_date).toBeNull();
    expect(medicine.batch_number).toBeNull();
    expect(medicine.supplier).toBeNull();
    
    // Verify non-null fields
    expect(medicine.unit).toEqual('tablet');
    expect(medicine.price).toEqual(1.75);
    expect(medicine.minimum_stock).toEqual(75);
    expect(medicine.current_stock).toEqual(300);
  });

  it('should handle large dataset correctly', async () => {
    // Create multiple medicines for testing ordering and performance
    const medicines = [];
    for (let i = 1; i <= 50; i++) {
      medicines.push({
        name: `Medicine ${i.toString().padStart(2, '0')}`,
        description: `Test medicine ${i}`,
        unit: 'tablet',
        price: (i * 1.5).toString(),
        minimum_stock: 10,
        current_stock: 100,
        expiry_date: '2025-12-31',
        batch_number: `BATCH${i}`,
        supplier: 'Test Supplier'
      });
    }

    await db.insert(medicinesTable).values(medicines).execute();

    const result = await getMedicines();

    expect(result).toHaveLength(50);
    
    // Verify ordering (alphabetical by name)
    expect(result[0].name).toEqual('Medicine 01');
    expect(result[1].name).toEqual('Medicine 02');
    expect(result[49].name).toEqual('Medicine 50');

    // Verify all have proper numeric conversion
    result.forEach(medicine => {
      expect(typeof medicine.price).toBe('number');
    });
  });

  it('should handle medicines with decimal prices correctly', async () => {
    // Create test medicines with various decimal prices
    await db.insert(medicinesTable).values([
      {
        name: 'Medicine A',
        description: 'Test medicine A',
        unit: 'tablet',
        price: '10.99',
        minimum_stock: 10,
        current_stock: 100,
        expiry_date: '2025-12-31',
        batch_number: 'BATCH01',
        supplier: 'Test Supplier'
      },
      {
        name: 'Medicine B',
        description: 'Test medicine B',
        unit: 'capsule',
        price: '0.50',
        minimum_stock: 20,
        current_stock: 200,
        expiry_date: '2025-06-30',
        batch_number: 'BATCH02',
        supplier: 'Test Supplier'
      }
    ]).execute();

    const result = await getMedicines();

    expect(result).toHaveLength(2);
    
    // Verify precise decimal conversion
    const medicineA = result.find(m => m.name === 'Medicine A');
    const medicineB = result.find(m => m.name === 'Medicine B');
    
    expect(medicineA?.price).toEqual(10.99);
    expect(medicineB?.price).toEqual(0.50);
    
    // Verify types
    expect(typeof medicineA?.price).toBe('number');
    expect(typeof medicineB?.price).toBe('number');
  });
});