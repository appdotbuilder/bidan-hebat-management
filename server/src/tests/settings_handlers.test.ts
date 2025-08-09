import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { settingsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type UpdateSettingsInput } from '../schema';
import {
  getSettings,
  getSettingByKey,
  updateSetting,
  getClinicInfo,
  updateClinicInfo,
  initializeDefaultSettings
} from '../handlers/settings_handlers';

describe('Settings Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getSettings', () => {
    it('should return empty array when no settings exist', async () => {
      const result = await getSettings();
      expect(result).toEqual([]);
    });

    it('should return all settings ordered by key', async () => {
      // Create test settings
      await db.insert(settingsTable).values([
        { key: 'zebra_setting', value: 'last', description: 'Should be last' },
        { key: 'alpha_setting', value: 'first', description: 'Should be first' },
        { key: 'beta_setting', value: 'middle', description: 'Should be middle' }
      ]).execute();

      const result = await getSettings();

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe('alpha_setting');
      expect(result[1].key).toBe('beta_setting');
      expect(result[2].key).toBe('zebra_setting');
      
      // Verify all fields are present
      result.forEach(setting => {
        expect(setting.id).toBeDefined();
        expect(setting.created_at).toBeInstanceOf(Date);
        expect(setting.updated_at).toBeInstanceOf(Date);
      });
    });
  });

  describe('getSettingByKey', () => {
    it('should return null when setting does not exist', async () => {
      const result = await getSettingByKey('nonexistent_key');
      expect(result).toBeNull();
    });

    it('should return setting when it exists', async () => {
      // Create test setting
      await db.insert(settingsTable).values({
        key: 'test_key',
        value: 'test_value',
        description: 'Test description'
      }).execute();

      const result = await getSettingByKey('test_key');

      expect(result).not.toBeNull();
      expect(result!.key).toBe('test_key');
      expect(result!.value).toBe('test_value');
      expect(result!.description).toBe('Test description');
      expect(result!.id).toBeDefined();
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updateSetting', () => {
    it('should create new setting when it does not exist', async () => {
      const input: UpdateSettingsInput = {
        key: 'new_setting',
        value: 'new_value'
      };

      const result = await updateSetting(input);

      expect(result.key).toBe('new_setting');
      expect(result.value).toBe('new_value');
      expect(result.description).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify it's saved in database
      const saved = await db.select()
        .from(settingsTable)
        .where(eq(settingsTable.key, 'new_setting'))
        .execute();

      expect(saved).toHaveLength(1);
      expect(saved[0].value).toBe('new_value');
    });

    it('should update existing setting', async () => {
      // Create initial setting
      const initialResult = await db.insert(settingsTable).values({
        key: 'existing_setting',
        value: 'old_value',
        description: 'Original description'
      }).returning().execute();

      const originalUpdatedAt = initialResult[0].updated_at;

      // Wait a moment to ensure updated_at changes
      await new Promise(resolve => setTimeout(resolve, 10));

      const input: UpdateSettingsInput = {
        key: 'existing_setting',
        value: 'updated_value'
      };

      const result = await updateSetting(input);

      expect(result.key).toBe('existing_setting');
      expect(result.value).toBe('updated_value');
      expect(result.description).toBe('Original description'); // Description should remain
      expect(result.id).toBe(initialResult[0].id);
      expect(result.created_at).toEqual(initialResult[0].created_at);
      expect(result.updated_at).not.toEqual(originalUpdatedAt); // Should be updated

      // Verify it's updated in database
      const updated = await db.select()
        .from(settingsTable)
        .where(eq(settingsTable.key, 'existing_setting'))
        .execute();

      expect(updated).toHaveLength(1);
      expect(updated[0].value).toBe('updated_value');
    });
  });

  describe('getClinicInfo', () => {
    it('should return default values when no settings exist', async () => {
      const result = await getClinicInfo();

      expect(result.name).toBe('Bidan Hebat Management');
      expect(result.address).toBeNull();
      expect(result.logo).toBeNull();
    });

    it('should return clinic info from settings', async () => {
      // Create clinic settings
      await db.insert(settingsTable).values([
        { key: 'clinic_name', value: 'Test Clinic' },
        { key: 'clinic_address', value: 'Test Address' },
        { key: 'clinic_logo', value: 'test-logo.png' }
      ]).execute();

      const result = await getClinicInfo();

      expect(result.name).toBe('Test Clinic');
      expect(result.address).toBe('Test Address');
      expect(result.logo).toBe('test-logo.png');
    });

    it('should handle partial clinic info', async () => {
      // Create only clinic name
      await db.insert(settingsTable).values({
        key: 'clinic_name',
        value: 'Partial Clinic'
      }).execute();

      const result = await getClinicInfo();

      expect(result.name).toBe('Partial Clinic');
      expect(result.address).toBeNull();
      expect(result.logo).toBeNull();
    });
  });

  describe('updateClinicInfo', () => {
    it('should update clinic name only', async () => {
      const result = await updateClinicInfo('New Clinic Name');

      expect(result).toBe(true);

      // Verify clinic name is saved
      const nameSetting = await getSettingByKey('clinic_name');
      expect(nameSetting?.value).toBe('New Clinic Name');

      // Verify no other settings were created
      const allSettings = await getSettings();
      expect(allSettings).toHaveLength(1);
    });

    it('should update all clinic info fields', async () => {
      const result = await updateClinicInfo(
        'Complete Clinic',
        'Complete Address',
        'complete-logo.png'
      );

      expect(result).toBe(true);

      // Verify all settings are saved
      const clinicInfo = await getClinicInfo();
      expect(clinicInfo.name).toBe('Complete Clinic');
      expect(clinicInfo.address).toBe('Complete Address');
      expect(clinicInfo.logo).toBe('complete-logo.png');

      // Verify three settings were created
      const allSettings = await getSettings();
      expect(allSettings).toHaveLength(3);
    });

    it('should update existing clinic info', async () => {
      // Create initial clinic info
      await db.insert(settingsTable).values([
        { key: 'clinic_name', value: 'Old Name' },
        { key: 'clinic_address', value: 'Old Address' }
      ]).execute();

      const result = await updateClinicInfo('Updated Name', 'Updated Address');

      expect(result).toBe(true);

      // Verify settings were updated, not duplicated
      const allSettings = await getSettings();
      expect(allSettings).toHaveLength(2);

      const clinicInfo = await getClinicInfo();
      expect(clinicInfo.name).toBe('Updated Name');
      expect(clinicInfo.address).toBe('Updated Address');
    });

    it('should handle empty string values', async () => {
      const result = await updateClinicInfo('Test Clinic', '', '');

      expect(result).toBe(true);

      const clinicInfo = await getClinicInfo();
      expect(clinicInfo.name).toBe('Test Clinic');
      expect(clinicInfo.address).toBe('');
      expect(clinicInfo.logo).toBe('');
    });
  });

  describe('initializeDefaultSettings', () => {
    it('should create all default settings when none exist', async () => {
      await initializeDefaultSettings();

      const allSettings = await getSettings();
      expect(allSettings).toHaveLength(5);

      // Verify default clinic settings
      const clinicName = await getSettingByKey('clinic_name');
      expect(clinicName?.value).toBe('Bidan Hebat Management');

      const clinicAddress = await getSettingByKey('clinic_address');
      expect(clinicAddress?.value).toBe('');

      const clinicLogo = await getSettingByKey('clinic_logo');
      expect(clinicLogo?.value).toBe('');

      // Verify other default settings
      const stockThreshold = await getSettingByKey('low_stock_threshold_days');
      expect(stockThreshold?.value).toBe('7');

      const receiptFooter = await getSettingByKey('receipt_footer_text');
      expect(receiptFooter?.value).toBe('Terima kasih atas kunjungan Anda');

      // Verify all settings have descriptions
      allSettings.forEach(setting => {
        expect(setting.description).not.toBeNull();
        expect(typeof setting.description).toBe('string');
      });
    });

    it('should not duplicate existing settings', async () => {
      // Create one existing setting
      await db.insert(settingsTable).values({
        key: 'clinic_name',
        value: 'Existing Clinic'
      }).execute();

      await initializeDefaultSettings();

      // Should have 5 total settings (1 existing + 4 new)
      const allSettings = await getSettings();
      expect(allSettings).toHaveLength(5);

      // Existing setting should not be overwritten
      const clinicName = await getSettingByKey('clinic_name');
      expect(clinicName?.value).toBe('Existing Clinic');

      // Other defaults should be created
      const receiptFooter = await getSettingByKey('receipt_footer_text');
      expect(receiptFooter?.value).toBe('Terima kasih atas kunjungan Anda');
    });

    it('should be safe to run multiple times', async () => {
      // Run initialization twice
      await initializeDefaultSettings();
      await initializeDefaultSettings();

      // Should still only have 5 settings
      const allSettings = await getSettings();
      expect(allSettings).toHaveLength(5);

      // Values should still be correct
      const clinicName = await getSettingByKey('clinic_name');
      expect(clinicName?.value).toBe('Bidan Hebat Management');
    });
  });

  describe('Error handling', () => {
    it('should handle database constraint violations', async () => {
      // Create a setting first
      await updateSetting({ key: 'test_key', value: 'test_value' });
      
      // Try to create another setting with the same key directly in database
      // This should cause a unique constraint violation
      await expect(async () => {
        await db.insert(settingsTable).values({
          key: 'test_key', // Duplicate key
          value: 'another_value'
        }).execute();
      }).toThrow();
    });
  });
});