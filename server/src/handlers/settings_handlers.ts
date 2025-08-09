import { db } from '../db';
import { settingsTable } from '../db/schema';
import { eq, asc } from 'drizzle-orm';
import { 
  type Settings, 
  type UpdateSettingsInput
} from '../schema';

export const getSettings = async (): Promise<Settings[]> => {
  try {
    const results = await db.select()
      .from(settingsTable)
      .orderBy(asc(settingsTable.key))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    throw error;
  }
};

export const getSettingByKey = async (key: string): Promise<Settings | null> => {
  try {
    const results = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.key, key))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch setting by key:', error);
    throw error;
  }
};

export const updateSetting = async (input: UpdateSettingsInput): Promise<Settings> => {
  try {
    // Check if setting exists
    const existing = await getSettingByKey(input.key);
    
    if (existing) {
      // Update existing setting
      const results = await db.update(settingsTable)
        .set({
          value: input.value,
          updated_at: new Date()
        })
        .where(eq(settingsTable.key, input.key))
        .returning()
        .execute();

      return results[0];
    } else {
      // Create new setting
      const results = await db.insert(settingsTable)
        .values({
          key: input.key,
          value: input.value,
          description: null
        })
        .returning()
        .execute();

      return results[0];
    }
  } catch (error) {
    console.error('Failed to update setting:', error);
    throw error;
  }
};

export const getClinicInfo = async (): Promise<{ name: string; address: string | null; logo: string | null }> => {
  try {
    // Fetch clinic information settings
    const nameResult = await getSettingByKey('clinic_name');
    const addressResult = await getSettingByKey('clinic_address');
    const logoResult = await getSettingByKey('clinic_logo');

    return {
      name: nameResult?.value || "Bidan Hebat Management",
      address: addressResult?.value ?? null, // Use nullish coalescing to preserve empty strings
      logo: logoResult?.value ?? null // Use nullish coalescing to preserve empty strings
    };
  } catch (error) {
    console.error('Failed to fetch clinic info:', error);
    throw error;
  }
};

export const updateClinicInfo = async (name: string, address?: string, logo?: string): Promise<boolean> => {
  try {
    // Update clinic name
    await updateSetting({ key: 'clinic_name', value: name });

    // Update clinic address if provided
    if (address !== undefined) {
      await updateSetting({ key: 'clinic_address', value: address });
    }

    // Update clinic logo if provided
    if (logo !== undefined) {
      await updateSetting({ key: 'clinic_logo', value: logo });
    }

    return true;
  } catch (error) {
    console.error('Failed to update clinic info:', error);
    return false;
  }
};

export const initializeDefaultSettings = async (): Promise<void> => {
  try {
    const defaultSettings = [
      { key: 'clinic_name', value: 'Bidan Hebat Management', description: 'Nama klinik' },
      { key: 'clinic_address', value: '', description: 'Alamat klinik' },
      { key: 'clinic_logo', value: '', description: 'Logo klinik' },
      { key: 'low_stock_threshold_days', value: '7', description: 'Ambang batas peringatan stok rendah (hari)' },
      { key: 'receipt_footer_text', value: 'Terima kasih atas kunjungan Anda', description: 'Teks footer struk' }
    ];

    // Check and create only non-existing settings
    for (const setting of defaultSettings) {
      const existing = await getSettingByKey(setting.key);
      if (!existing) {
        await db.insert(settingsTable)
          .values({
            key: setting.key,
            value: setting.value,
            description: setting.description
          })
          .execute();
      }
    }
  } catch (error) {
    console.error('Failed to initialize default settings:', error);
    throw error;
  }
};