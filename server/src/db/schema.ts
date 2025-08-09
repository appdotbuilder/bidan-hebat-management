import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer,
  date,
  pgEnum
} from 'drizzle-orm/pg-core';

// Enums
export const stockTransactionTypeEnum = pgEnum('stock_transaction_type', ['IN', 'OUT']);
export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'DEBIT', 'CREDIT', 'TRANSFER']);
export const transactionStatusEnum = pgEnum('transaction_status', ['PENDING', 'COMPLETED', 'CANCELLED']);
export const genderEnum = pgEnum('gender', ['L', 'P']);

// Medicines table - Tabel Obat
export const medicinesTable = pgTable('medicines', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'), // nullable by default
  unit: text('unit').notNull(), // satuan (tablet, botol, strip, etc.)
  price: numeric('price', { precision: 10, scale: 2 }).notNull(), // harga satuan
  minimum_stock: integer('minimum_stock').notNull(), // ambang batas stok minimum
  current_stock: integer('current_stock').notNull(), // stok saat ini
  expiry_date: date('expiry_date'), // tanggal kedaluwarsa
  batch_number: text('batch_number'), // nomor batch
  supplier: text('supplier'), // pemasok
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Stock transactions table - Tabel Transaksi Stok (masuk/keluar)
export const stockTransactionsTable = pgTable('stock_transactions', {
  id: serial('id').primaryKey(),
  medicine_id: integer('medicine_id').references(() => medicinesTable.id).notNull(),
  type: stockTransactionTypeEnum('type').notNull(), // IN atau OUT
  quantity: integer('quantity').notNull(), // jumlah
  notes: text('notes'), // catatan
  transaction_date: timestamp('transaction_date').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Patients table - Tabel Pasien
export const patientsTable = pgTable('patients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  birth_date: date('birth_date'), // tanggal lahir
  gender: genderEnum('gender'), // jenis kelamin
  phone: text('phone'), // nomor telepon
  address: text('address'), // alamat
  medical_history: text('medical_history'), // riwayat medis
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Sales transactions table - Tabel Transaksi Penjualan
export const salesTransactionsTable = pgTable('sales_transactions', {
  id: serial('id').primaryKey(),
  patient_id: integer('patient_id').references(() => patientsTable.id), // bisa null untuk walk-in customer
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(), // total amount
  payment_method: paymentMethodEnum('payment_method').notNull(), // metode pembayaran
  payment_received: numeric('payment_received', { precision: 10, scale: 2 }).notNull(), // uang yang diterima
  change_amount: numeric('change_amount', { precision: 10, scale: 2 }).notNull(), // kembalian
  status: transactionStatusEnum('status').notNull().default('COMPLETED'), // status transaksi
  notes: text('notes'), // catatan
  transaction_date: timestamp('transaction_date').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Sales transaction items table - Tabel Item Transaksi Penjualan
export const salesTransactionItemsTable = pgTable('sales_transaction_items', {
  id: serial('id').primaryKey(),
  transaction_id: integer('transaction_id').references(() => salesTransactionsTable.id).notNull(),
  medicine_id: integer('medicine_id').references(() => medicinesTable.id).notNull(),
  quantity: integer('quantity').notNull(), // jumlah
  unit_price: numeric('unit_price', { precision: 10, scale: 2 }).notNull(), // harga satuan saat transaksi
  total_price: numeric('total_price', { precision: 10, scale: 2 }).notNull(), // total harga item
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Settings table - Tabel Pengaturan (untuk branding, dll)
export const settingsTable = pgTable('settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(), // kunci pengaturan
  value: text('value'), // nilai pengaturan
  description: text('description'), // deskripsi
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// TypeScript types for the table schemas
export type Medicine = typeof medicinesTable.$inferSelect;
export type NewMedicine = typeof medicinesTable.$inferInsert;

export type StockTransaction = typeof stockTransactionsTable.$inferSelect;
export type NewStockTransaction = typeof stockTransactionsTable.$inferInsert;

export type Patient = typeof patientsTable.$inferSelect;
export type NewPatient = typeof patientsTable.$inferInsert;

export type SalesTransaction = typeof salesTransactionsTable.$inferSelect;
export type NewSalesTransaction = typeof salesTransactionsTable.$inferInsert;

export type SalesTransactionItem = typeof salesTransactionItemsTable.$inferSelect;
export type NewSalesTransactionItem = typeof salesTransactionItemsTable.$inferInsert;

export type Settings = typeof settingsTable.$inferSelect;
export type NewSettings = typeof settingsTable.$inferInsert;

// Export all tables for proper query building and relations
export const tables = {
  medicines: medicinesTable,
  stockTransactions: stockTransactionsTable,
  patients: patientsTable,
  salesTransactions: salesTransactionsTable,
  salesTransactionItems: salesTransactionItemsTable,
  settings: settingsTable,
};