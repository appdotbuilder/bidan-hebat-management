import { z } from 'zod';

// Enums for various statuses
export const stockTransactionTypeEnum = z.enum(['IN', 'OUT']);
export type StockTransactionType = z.infer<typeof stockTransactionTypeEnum>;

export const paymentMethodEnum = z.enum(['CASH', 'DEBIT', 'CREDIT', 'TRANSFER']);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const transactionStatusEnum = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);
export type TransactionStatus = z.infer<typeof transactionStatusEnum>;

export const genderEnum = z.enum(['L', 'P']); // Laki-laki, Perempuan
export type Gender = z.infer<typeof genderEnum>;

// Medicine Schema
export const medicineSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  unit: z.string(), // tablet, botol, strip, etc.
  price: z.number(), // Harga satuan
  minimum_stock: z.number().int(), // Ambang batas stok minimum
  current_stock: z.number().int(), // Stok saat ini
  expiry_date: z.coerce.date().nullable(),
  batch_number: z.string().nullable(),
  supplier: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Medicine = z.infer<typeof medicineSchema>;

// Input schemas for medicine
export const createMedicineInputSchema = z.object({
  name: z.string().min(1, 'Nama obat harus diisi'),
  description: z.string().nullable(),
  unit: z.string().min(1, 'Satuan harus diisi'),
  price: z.number().positive('Harga harus lebih dari 0'),
  minimum_stock: z.number().int().nonnegative('Stok minimum tidak boleh negatif'),
  current_stock: z.number().int().nonnegative('Stok saat ini tidak boleh negatif'),
  expiry_date: z.coerce.date().nullable(),
  batch_number: z.string().nullable(),
  supplier: z.string().nullable()
});

export type CreateMedicineInput = z.infer<typeof createMedicineInputSchema>;

export const updateMedicineInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1, 'Nama obat harus diisi').optional(),
  description: z.string().nullable().optional(),
  unit: z.string().min(1, 'Satuan harus diisi').optional(),
  price: z.number().positive('Harga harus lebih dari 0').optional(),
  minimum_stock: z.number().int().nonnegative('Stok minimum tidak boleh negatif').optional(),
  current_stock: z.number().int().nonnegative('Stok saat ini tidak boleh negatif').optional(),
  expiry_date: z.coerce.date().nullable().optional(),
  batch_number: z.string().nullable().optional(),
  supplier: z.string().nullable().optional()
});

export type UpdateMedicineInput = z.infer<typeof updateMedicineInputSchema>;

// Stock Transaction Schema
export const stockTransactionSchema = z.object({
  id: z.number(),
  medicine_id: z.number(),
  type: stockTransactionTypeEnum,
  quantity: z.number().int(),
  notes: z.string().nullable(),
  transaction_date: z.coerce.date(),
  created_at: z.coerce.date()
});

export type StockTransaction = z.infer<typeof stockTransactionSchema>;

export const createStockTransactionInputSchema = z.object({
  medicine_id: z.number(),
  type: stockTransactionTypeEnum,
  quantity: z.number().int().positive('Jumlah harus lebih dari 0'),
  notes: z.string().nullable()
});

export type CreateStockTransactionInput = z.infer<typeof createStockTransactionInputSchema>;

// Patient Schema
export const patientSchema = z.object({
  id: z.number(),
  name: z.string(),
  birth_date: z.coerce.date().nullable(),
  gender: genderEnum.nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  medical_history: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Patient = z.infer<typeof patientSchema>;

export const createPatientInputSchema = z.object({
  name: z.string().min(1, 'Nama pasien harus diisi'),
  birth_date: z.coerce.date().nullable(),
  gender: genderEnum.nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  medical_history: z.string().nullable()
});

export type CreatePatientInput = z.infer<typeof createPatientInputSchema>;

export const updatePatientInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1, 'Nama pasien harus diisi').optional(),
  birth_date: z.coerce.date().nullable().optional(),
  gender: genderEnum.nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  medical_history: z.string().nullable().optional()
});

export type UpdatePatientInput = z.infer<typeof updatePatientInputSchema>;

// Sales Transaction Schema
export const salesTransactionSchema = z.object({
  id: z.number(),
  patient_id: z.number().nullable(),
  total_amount: z.number(),
  payment_method: paymentMethodEnum,
  payment_received: z.number(),
  change_amount: z.number(),
  status: transactionStatusEnum,
  notes: z.string().nullable(),
  transaction_date: z.coerce.date(),
  created_at: z.coerce.date()
});

export type SalesTransaction = z.infer<typeof salesTransactionSchema>;

// Sales Transaction Item Schema
export const salesTransactionItemSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  medicine_id: z.number(),
  quantity: z.number().int(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type SalesTransactionItem = z.infer<typeof salesTransactionItemSchema>;

export const createSalesTransactionInputSchema = z.object({
  patient_id: z.number().nullable(),
  payment_method: paymentMethodEnum,
  payment_received: z.number().positive('Jumlah bayar harus lebih dari 0'),
  notes: z.string().nullable(),
  items: z.array(z.object({
    medicine_id: z.number(),
    quantity: z.number().int().positive('Jumlah harus lebih dari 0')
  })).min(1, 'Minimal harus ada satu item')
});

export type CreateSalesTransactionInput = z.infer<typeof createSalesTransactionInputSchema>;

// Settings Schema (for customizable branding)
export const settingsSchema = z.object({
  id: z.number(),
  key: z.string(),
  value: z.string().nullable(),
  description: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Settings = z.infer<typeof settingsSchema>;

export const updateSettingsInputSchema = z.object({
  key: z.string(),
  value: z.string()
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

// Dashboard Stats Schema
export const dashboardStatsSchema = z.object({
  total_medicines: z.number(),
  low_stock_medicines: z.number(),
  expired_medicines: z.number(),
  total_patients: z.number(),
  today_sales: z.number(),
  today_transactions: z.number(),
  total_revenue: z.number()
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

// Low Stock Medicine Schema
export const lowStockMedicineSchema = z.object({
  id: z.number(),
  name: z.string(),
  current_stock: z.number(),
  minimum_stock: z.number(),
  unit: z.string()
});

export type LowStockMedicine = z.infer<typeof lowStockMedicineSchema>;

// Expired Medicine Schema
export const expiredMedicineSchema = z.object({
  id: z.number(),
  name: z.string(),
  expiry_date: z.coerce.date(),
  current_stock: z.number(),
  unit: z.string()
});

export type ExpiredMedicine = z.infer<typeof expiredMedicineSchema>;

// Receipt Data Schema
export const receiptDataSchema = z.object({
  transaction: salesTransactionSchema,
  items: z.array(salesTransactionItemSchema.extend({
    medicine_name: z.string(),
    medicine_unit: z.string()
  })),
  patient: patientSchema.nullable(),
  clinic_name: z.string(),
  clinic_address: z.string().nullable()
});

export type ReceiptData = z.infer<typeof receiptDataSchema>;

// Patient Visit History Schema
export const patientVisitSchema = z.object({
  transaction_id: z.number(),
  transaction_date: z.coerce.date(),
  total_amount: z.number(),
  items: z.array(z.object({
    medicine_name: z.string(),
    quantity: z.number(),
    unit_price: z.number(),
    total_price: z.number()
  }))
});

export type PatientVisit = z.infer<typeof patientVisitSchema>;

// Search schemas
export const searchMedicineInputSchema = z.object({
  query: z.string().optional(),
  low_stock_only: z.boolean().optional(),
  expired_only: z.boolean().optional()
});

export type SearchMedicineInput = z.infer<typeof searchMedicineInputSchema>;

export const searchPatientInputSchema = z.object({
  query: z.string().optional()
});

export type SearchPatientInput = z.infer<typeof searchPatientInputSchema>;

// Report schemas
export const reportPeriodInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date()
});

export type ReportPeriodInput = z.infer<typeof reportPeriodInputSchema>;

export const salesReportSchema = z.object({
  period: z.string(),
  total_transactions: z.number(),
  total_revenue: z.number(),
  transactions: z.array(salesTransactionSchema.extend({
    patient_name: z.string().nullable()
  }))
});

export type SalesReport = z.infer<typeof salesReportSchema>;

export const stockReportSchema = z.object({
  period: z.string(),
  total_medicines: z.number(),
  low_stock_count: z.number(),
  expired_count: z.number(),
  medicines: z.array(medicineSchema)
});

export type StockReport = z.infer<typeof stockReportSchema>;