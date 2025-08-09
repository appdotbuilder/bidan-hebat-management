import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import all schemas
import {
  createMedicineInputSchema,
  updateMedicineInputSchema,
  searchMedicineInputSchema,
  createStockTransactionInputSchema,
  createPatientInputSchema,
  updatePatientInputSchema,
  searchPatientInputSchema,
  createSalesTransactionInputSchema,
  updateSettingsInputSchema,
  reportPeriodInputSchema
} from './schema';

// Import all handlers
import {
  createMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  deleteMedicine,
  searchMedicines,
  getLowStockMedicines,
  getExpiredMedicines
} from './handlers/medicine_handlers';

import {
  createStockTransaction,
  getStockTransactions,
  getStockTransactionsByMedicine,
  getStockTransactionHistory
} from './handlers/stock_handlers';

import {
  createPatient,
  getPatients,
  getPatientById,
  updatePatient,
  deletePatient,
  searchPatients,
  getPatientVisitHistory
} from './handlers/patient_handlers';

import {
  createSalesTransaction,
  getSalesTransactions,
  getSalesTransactionById,
  getSalesTransactionsByDateRange,
  getTodaySalesTransactions,
  getReceiptData,
  cancelSalesTransaction
} from './handlers/sales_handlers';

import {
  getDashboardStats,
  getTodayRevenue,
  getMonthlyRevenue,
  generateSalesReport,
  generateStockReport
} from './handlers/dashboard_handlers';

import {
  getSettings,
  getSettingByKey,
  updateSetting,
  getClinicInfo,
  updateClinicInfo,
  initializeDefaultSettings
} from './handlers/settings_handlers';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Medicine management routes
  medicines: router({
    create: publicProcedure
      .input(createMedicineInputSchema)
      .mutation(({ input }) => createMedicine(input)),
    
    getAll: publicProcedure
      .query(() => getMedicines()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getMedicineById(input.id)),
    
    update: publicProcedure
      .input(updateMedicineInputSchema)
      .mutation(({ input }) => updateMedicine(input)),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteMedicine(input.id)),
    
    search: publicProcedure
      .input(searchMedicineInputSchema)
      .query(({ input }) => searchMedicines(input)),
    
    getLowStock: publicProcedure
      .query(() => getLowStockMedicines()),
    
    getExpired: publicProcedure
      .query(() => getExpiredMedicines()),
  }),

  // Stock management routes
  stock: router({
    createTransaction: publicProcedure
      .input(createStockTransactionInputSchema)
      .mutation(({ input }) => createStockTransaction(input)),
    
    getTransactions: publicProcedure
      .query(() => getStockTransactions()),
    
    getTransactionsByMedicine: publicProcedure
      .input(z.object({ medicineId: z.number() }))
      .query(({ input }) => getStockTransactionsByMedicine(input.medicineId)),
    
    getHistory: publicProcedure
      .input(reportPeriodInputSchema)
      .query(({ input }) => getStockTransactionHistory(input.start_date, input.end_date)),
  }),

  // Patient management routes
  patients: router({
    create: publicProcedure
      .input(createPatientInputSchema)
      .mutation(({ input }) => createPatient(input)),
    
    getAll: publicProcedure
      .query(() => getPatients()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getPatientById(input.id)),
    
    update: publicProcedure
      .input(updatePatientInputSchema)
      .mutation(({ input }) => updatePatient(input)),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deletePatient(input.id)),
    
    search: publicProcedure
      .input(searchPatientInputSchema)
      .query(({ input }) => searchPatients(input)),
    
    getVisitHistory: publicProcedure
      .input(z.object({ patientId: z.number() }))
      .query(({ input }) => getPatientVisitHistory(input.patientId)),
  }),

  // Sales/Cashier system routes
  sales: router({
    createTransaction: publicProcedure
      .input(createSalesTransactionInputSchema)
      .mutation(({ input }) => createSalesTransaction(input)),
    
    getTransactions: publicProcedure
      .query(() => getSalesTransactions()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getSalesTransactionById(input.id)),
    
    getByDateRange: publicProcedure
      .input(reportPeriodInputSchema)
      .query(({ input }) => getSalesTransactionsByDateRange(input.start_date, input.end_date)),
    
    getTodayTransactions: publicProcedure
      .query(() => getTodaySalesTransactions()),
    
    getReceiptData: publicProcedure
      .input(z.object({ transactionId: z.number() }))
      .query(({ input }) => getReceiptData(input.transactionId)),
    
    cancelTransaction: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => cancelSalesTransaction(input.id)),
  }),

  // Dashboard and reporting routes
  dashboard: router({
    getStats: publicProcedure
      .query(() => getDashboardStats()),
    
    getTodayRevenue: publicProcedure
      .query(() => getTodayRevenue()),
    
    getMonthlyRevenue: publicProcedure
      .query(() => getMonthlyRevenue()),
    
    generateSalesReport: publicProcedure
      .input(reportPeriodInputSchema)
      .query(({ input }) => generateSalesReport(input)),
    
    generateStockReport: publicProcedure
      .input(reportPeriodInputSchema)
      .query(({ input }) => generateStockReport(input)),
  }),

  // Settings and configuration routes
  settings: router({
    getAll: publicProcedure
      .query(() => getSettings()),
    
    getByKey: publicProcedure
      .input(z.object({ key: z.string() }))
      .query(({ input }) => getSettingByKey(input.key)),
    
    update: publicProcedure
      .input(updateSettingsInputSchema)
      .mutation(({ input }) => updateSetting(input)),
    
    getClinicInfo: publicProcedure
      .query(() => getClinicInfo()),
    
    updateClinicInfo: publicProcedure
      .input(z.object({
        name: z.string(),
        address: z.string().optional(),
        logo: z.string().optional()
      }))
      .mutation(({ input }) => updateClinicInfo(input.name, input.address, input.logo)),
    
    initialize: publicProcedure
      .mutation(() => initializeDefaultSettings()),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  
  // Initialize default settings on startup
  try {
    await initializeDefaultSettings();
    console.log('Default settings initialized successfully');
  } catch (error) {
    console.error('Error initializing default settings:', error);
  }
  
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  
  server.listen(port);
  console.log(`🏥 Bidan Hebat Management TRPC Server listening at port: ${port}`);
  console.log(`📊 Dashboard: http://localhost:${port}`);
  console.log(`💊 Medicine Management: Ready`);
  console.log(`👥 Patient Management: Ready`);
  console.log(`💰 Cashier System: Ready`);
  console.log(`📈 Inventory Management: Ready`);
}

start().catch(console.error);