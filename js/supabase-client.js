/**
 * Supabase Cloud Integration Client for MVIT Faculty Appraisal Portal
 * 
 * Provides cloud database synchronization, storage upload, and real-time state
 * management with graceful fallback to LocalStorage/IndexedDB when offline.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.ParSupabase = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY_CONFIG = 'par_supabase_credentials_v1';
  let supabaseClient = null;
  let connectionStatus = 'unconfigured'; // 'unconfigured' | 'connected' | 'error' | 'testing'

  /**
   * Retrieves active credentials (prefers LocalStorage overrides, falls back to config file)
   */
  function getConfig() {
    let localConfig = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
        if (stored) {
          localConfig = JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn('[Supabase] Failed to read localStorage config:', e);
    }

    if (localConfig && localConfig.url && localConfig.anonKey) {
      return localConfig;
    }

    if (typeof window !== 'undefined' && window.MVIT_SUPABASE_CONFIG) {
      if (window.MVIT_SUPABASE_CONFIG.url && window.MVIT_SUPABASE_CONFIG.anonKey) {
        return window.MVIT_SUPABASE_CONFIG;
      }
    }

    return { url: '', anonKey: '' };
  }

  /**
   * Saves credentials to LocalStorage and initializes client
   */
  function saveConfig(url, anonKey) {
    const cleanUrl = (url || '').trim().replace(/\/+$/, '');
    const cleanKey = (anonKey || '').trim();

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({
        url: cleanUrl,
        anonKey: cleanKey
      }));
    }

    return initClient();
  }

  /**
   * Clears saved Supabase credentials
   */
  function clearConfig() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_CONFIG);
    }
    supabaseClient = null;
    connectionStatus = 'unconfigured';
    notifyStatusChange();
  }

  /**
   * Checks if Supabase credentials are configured
   */
  function isConfigured() {
    const cfg = getConfig();
    return Boolean(cfg.url && cfg.anonKey);
  }

  /**
   * Initializes the Supabase client
   */
  function initClient() {
    const cfg = getConfig();
    if (!cfg.url || !cfg.anonKey) {
      supabaseClient = null;
      connectionStatus = 'unconfigured';
      notifyStatusChange();
      return null;
    }

    const sbLib = (typeof window !== 'undefined' && window.supabase) 
      ? window.supabase 
      : (typeof globalThis !== 'undefined' && globalThis.supabase ? globalThis.supabase : null);

    if (!sbLib || typeof sbLib.createClient !== 'function') {
      console.warn('[Supabase] Supabase JS library (@supabase/supabase-js) is not yet loaded.');
      connectionStatus = 'unconfigured';
      return null;
    }

    try {
      supabaseClient = sbLib.createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      connectionStatus = 'connected';
      notifyStatusChange();
      return supabaseClient;
    } catch (err) {
      console.error('[Supabase] Error creating client:', err);
      connectionStatus = 'error';
      notifyStatusChange();
      return null;
    }
  }

  /**
   * Tests connection to Supabase project by querying par_reports
   */
  async function testConnection(customUrl, customKey) {
    const url = customUrl || getConfig().url;
    const key = customKey || getConfig().anonKey;

    if (!url || !key) {
      return { success: false, message: 'Supabase URL and Anon Key are required.' };
    }

    const sbLib = (typeof window !== 'undefined' && window.supabase) ? window.supabase : null;
    if (!sbLib || typeof sbLib.createClient !== 'function') {
      return { success: false, message: 'Supabase library is still loading. Please check your internet connection.' };
    }

    try {
      const testClient = sbLib.createClient(url.trim().replace(/\/+$/, ''), key.trim());
      const { data, error } = await testClient
        .from('par_reports')
        .select('id')
        .limit(1);

      if (error) {
        const msg = String(error.message || '');
        if (error.code === '42P01' || error.code === 'PGRST205' || msg.includes('Could not find the table') || msg.includes('schema cache')) {
          return {
            success: false,
            tableMissing: true,
            message: 'Connected to Supabase, but the database tables are not created yet. Please run the SQL schema in your Supabase SQL Editor.'
          };
        }
        return { success: false, message: error.message || 'Failed to connect to Supabase.' };
      }

      connectionStatus = 'connected';
      notifyStatusChange();
      return { success: true, message: 'Successfully connected to Supabase project!' };
    } catch (err) {
      return { success: false, message: err.message || 'Connection test failed.' };
    }
  }

  function getClient() {
    if (!supabaseClient) {
      initClient();
    }
    return supabaseClient;
  }

  function getStatus() {
    return connectionStatus;
  }

  const listeners = [];
  function onStatusChange(callback) {
    if (typeof callback === 'function') listeners.push(callback);
  }

  function notifyStatusChange() {
    listeners.forEach(fn => {
      try { fn(connectionStatus); } catch (e) { /* ignore */ }
    });
  }

  // =========================================================================
  // PAR Reports Cloud Operations
  // =========================================================================

  /**
   * Syncs a single PAR report to the Supabase database
   */
  async function syncReportToCloud(report) {
    const client = getClient();
    if (!client) return { success: false, reason: 'Not configured' };

    try {
      const record = {
        id: report.id,
        faculty_id: report.facultyInfo ? report.facultyInfo.employeeId || null : null,
        faculty_name: report.facultyInfo ? report.facultyInfo.name || 'Unnamed Faculty' : 'Unnamed Faculty',
        department: report.facultyInfo ? report.facultyInfo.department || null : null,
        designation: report.facultyInfo ? report.facultyInfo.designation || null : null,
        academic_year: report.academicYear || '2024-25',
        fpi: (report.fpiComputation && typeof report.fpiComputation.fpi === 'number') ? report.fpiComputation.fpi : null,
        status: report.status || 'Draft',
        data: report,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('par_reports')
        .upsert(record, { onConflict: 'id' })
        .select('id');

      if (error) {
        console.error('[Supabase] syncReportToCloud error:', error);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      console.error('[Supabase] syncReportToCloud exception:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Fetches all reports from the cloud database
   */
  async function fetchReportsFromCloud() {
    const client = getClient();
    if (!client) return { success: false, reason: 'Not configured', reports: [] };

    try {
      const { data, error } = await client
        .from('par_reports')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[Supabase] fetchReportsFromCloud error:', error);
        return { success: false, error: error.message, reports: [] };
      }

      const reports = (data || []).map(row => row.data || row);
      return { success: true, reports };
    } catch (err) {
      console.error('[Supabase] fetchReportsFromCloud exception:', err);
      return { success: false, error: err.message, reports: [] };
    }
  }

  /**
   * Deletes a report from the cloud database
   */
  async function deleteReportFromCloud(id) {
    const client = getClient();
    if (!client) return { success: false, reason: 'Not configured' };

    try {
      const { error } = await client
        .from('par_reports')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[Supabase] deleteReportFromCloud error:', error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.error('[Supabase] deleteReportFromCloud exception:', err);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // FPAS (700 Marks) Form Sync
  // =========================================================================

  /**
   * Syncs an FPAS record to Supabase
   */
  async function syncFpasToCloud(fpasRecord) {
    const client = getClient();
    if (!client) return { success: false, reason: 'Not configured' };

    try {
      const record = {
        id: fpasRecord.id || ('fpas_' + Date.now()),
        academic_year: fpasRecord.academicYear || '',
        faculty_name: fpasRecord.facultyName || '',
        empid: fpasRecord.empid || '',
        designation: fpasRecord.designation || '',
        department: fpasRecord.department || '',
        form_data: fpasRecord.formData || {},
        total_awarded: fpasRecord.totalAwarded || null,
        percentage: fpasRecord.percentage || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await client
        .from('fpas_records')
        .upsert(record, { onConflict: 'id' });

      if (error) {
        console.error('[Supabase] syncFpasToCloud error:', error);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      console.error('[Supabase] syncFpasToCloud exception:', err);
      return { success: false, error: err.message };
    }
  }

  // =========================================================================
  // File Storage (Evidence Attachments)
  // =========================================================================

  /**
   * Uploads an evidence file to the 'appraisal-evidence' Supabase storage bucket
   */
  async function uploadEvidence(file, reportId) {
    const client = getClient();
    if (!client) return { success: false, reason: 'Not configured' };

    try {
      const ext = file.name.split('.').pop();
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${reportId || 'general'}/${Date.now()}_${cleanName}`;

      const { data, error } = await client
        .storage
        .from('appraisal-evidence')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('[Supabase] uploadEvidence error:', error);
        return { success: false, error: error.message };
      }

      // Get public URL
      const { data: urlData } = client
        .storage
        .from('appraisal-evidence')
        .getPublicUrl(filePath);

      return {
        success: true,
        path: filePath,
        publicUrl: urlData ? urlData.publicUrl : null
      };
    } catch (err) {
      console.error('[Supabase] uploadEvidence exception:', err);
      return { success: false, error: err.message };
    }
  }

  // Initialize on load
  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', function () {
      initClient();
    });
  }

  return {
    getConfig,
    saveConfig,
    clearConfig,
    isConfigured,
    initClient,
    testConnection,
    getClient,
    getStatus,
    onStatusChange,
    syncReportToCloud,
    fetchReportsFromCloud,
    deleteReportFromCloud,
    syncFpasToCloud,
    uploadEvidence
  };
});
