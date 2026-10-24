/**
 * Supabase Cloud UI Controller
 * Manages the Cloud Configuration modal, connection status badge,
 * sync operations, and user feedback.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.ParSupabaseUI = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function initUI() {
    updateNavbarBadge();
    if (window.ParSupabase) {
      window.ParSupabase.onStatusChange(updateNavbarBadge);
    }
  }

  function updateNavbarBadge() {
    const badge = document.getElementById('supabase-status-badge');
    const text = document.getElementById('supabase-status-text');
    if (!badge) return;

    const isCfg = window.ParSupabase && window.ParSupabase.isConfigured();
    if (isCfg) {
      badge.className = 'supabase-badge connected';
      badge.title = 'Supabase Cloud: Configured';
      if (text) text.textContent = 'Cloud Connected';
    } else {
      badge.className = 'supabase-badge disconnected';
      badge.title = 'Supabase Cloud: Not configured';
      if (text) text.textContent = 'Setup Cloud';
    }
  }

  function openModal() {
    const modalEl = document.getElementById('par-modal-container');
    if (!modalEl) return;

    const cfg = window.ParSupabase ? window.ParSupabase.getConfig() : { url: '', anonKey: '' };
    const isCfg = window.ParSupabase && window.ParSupabase.isConfigured();

    modalEl.innerHTML = `
      <div class="par-modal-overlay" onclick="if(event.target === this) ParApp.closeModal()">
        <div class="par-modal" style="max-width: 680px;">
          <div class="par-modal-header">
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:24px;">⚡</span>
              <div>
                <h3 style="margin:0; color:#1a365d;">Supabase Cloud Integration</h3>
                <p style="margin:2px 0 0 0; font-size:12px; color:#718096;">Sync appraisal reports, forms, and evidence files to your Supabase project</p>
              </div>
            </div>
            <button class="par-modal-close" onclick="ParApp.closeModal()">✕</button>
          </div>

          <div id="sb-conn-status-banner" class="par-alert ${isCfg ? 'par-alert-success' : 'par-alert-info'}" style="margin-bottom:16px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div>
                <strong>Status:</strong> ${isCfg ? '🟢 Configured & Ready' : '⚪ Not Configured (Using Local Storage)'}
              </div>
              ${isCfg ? '<button class="par-btn par-btn-sm par-btn-secondary" onclick="ParSupabaseUI.testConnectionFromModal()">🔌 Test Connection</button>' : ''}
            </div>
          </div>

          <div style="margin-bottom:16px;">
            <div class="par-form-group" style="margin-bottom:12px;">
              <label for="sb_input_url" style="font-weight:600; font-size:13px; color:#2d3748; display:block; margin-bottom:4px;">
                Supabase Project URL <span style="color:#c53030;">*</span>
              </label>
              <input type="url" id="sb_input_url" class="par-input" placeholder="https://your-project-id.supabase.co" value="${escapeHtml(cfg.url || '')}" style="width:100%; box-sizing:border-box;" />
              <div style="font-size:11px; color:#718096; margin-top:3px;">Found in Supabase Dashboard → Settings → API → Project URL</div>
            </div>

            <div class="par-form-group" style="margin-bottom:16px;">
              <label for="sb_input_key" style="font-weight:600; font-size:13px; color:#2d3748; display:block; margin-bottom:4px;">
                Supabase Anonymous Public Key (<code>anon</code> / <code>public</code>) <span style="color:#c53030;">*</span>
              </label>
              <input type="password" id="sb_input_key" class="par-input" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value="${escapeHtml(cfg.anonKey || '')}" style="width:100%; box-sizing:border-box;" />
              <div style="font-size:11px; color:#718096; margin-top:3px;">Found in Supabase Dashboard → Settings → API → Project API Keys (anon/public)</div>
            </div>

            <div id="sb-test-feedback" style="display:none; padding:10px 14px; border-radius:6px; font-size:13px; margin-bottom:14px;"></div>

            <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
              ${isCfg ? '<button class="par-btn par-btn-danger" onclick="ParSupabaseUI.disconnect()">🗑️ Disconnect</button>' : ''}
              <button class="par-btn par-btn-secondary" onclick="ParSupabaseUI.testConnectionFromModal()">🔌 Test Connection</button>
              <button class="par-btn par-btn-primary" onclick="ParSupabaseUI.saveSettingsFromModal()">💾 Save & Connect</button>
            </div>
          </div>

          <!-- Cloud Sync Actions Section -->
          ${isCfg ? `
            <div style="border-top:1px solid #e2e8f0; padding-top:16px; margin-top:16px;">
              <h4 style="margin:0 0 10px 0; color:#1a365d; font-size:14px;">Cloud Synchronization Actions</h4>
              <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <button class="par-btn par-btn-secondary" onclick="ParSupabaseUI.syncAllLocalToCloud()" style="flex:1;">
                  ⬆️ Sync All Local Data to Supabase
                </button>
                <button class="par-btn par-btn-secondary" onclick="ParSupabaseUI.pullCloudToLocal()" style="flex:1;">
                  ⬇️ Pull Cloud Reports to Local
                </button>
              </div>
              <div id="sb-sync-feedback" style="display:none; font-size:12.5px; margin-top:10px;"></div>
            </div>
          ` : ''}

          <!-- SQL Schema Help Section -->
          <div style="border-top:1px solid #e2e8f0; padding-top:14px; margin-top:16px; font-size:12px; color:#4a5568;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <div>
                <strong>Database Schema:</strong> Run <code style="background:#edf2f7; padding:2px 4px; border-radius:3px;">supabase/schema.sql</code> in your <strong>Supabase SQL Editor</strong>.
              </div>
              <button class="par-btn par-btn-sm par-btn-secondary" onclick="ParSupabaseUI.copySchemaSql()" style="font-size:11.5px; padding:3px 10px;">
                📋 Copy SQL Script
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function testConnectionFromModal() {
    const url = document.getElementById('sb_input_url').value;
    const key = document.getElementById('sb_input_key').value;
    const feedback = document.getElementById('sb-test-feedback');

    if (!feedback) return;
    feedback.style.display = 'block';
    feedback.style.background = '#edf2f7';
    feedback.style.color = '#2d3748';
    feedback.style.border = '1px solid #cbd5e0';
    feedback.innerHTML = '⏳ Testing connection to Supabase project...';

    const res = await window.ParSupabase.testConnection(url, key);
    if (res.success) {
      feedback.style.background = '#f0fff4';
      feedback.style.color = '#276749';
      feedback.style.border = '1px solid #9ae6b4';
      feedback.innerHTML = '✅ ' + res.message;
    } else if (res.tableMissing) {
      feedback.style.background = '#fffaf0';
      feedback.style.color = '#744210';
      feedback.style.border = '1px solid #fbd38d';
      
      // Extract project ref if available (e.g. from https://xyz.supabase.co)
      let projectRef = '';
      try {
        const u = new URL(url.trim());
        projectRef = u.hostname.split('.')[0];
      } catch (e) { /* ignore */ }
      
      const sqlEditorUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}/sql/new` : 'https://supabase.com/dashboard';

      feedback.innerHTML = `
        <div style="font-weight:700; margin-bottom:4px;">⚠️ Connection successful, but tables are missing!</div>
        <div style="font-size:12px; margin-bottom:8px;">
          Your Supabase credentials are valid, but the required tables (<code>public.par_reports</code>, <code>par_weight_configs</code>, <code>fpas_records</code>) have not been created yet.
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="par-btn par-btn-sm par-btn-primary" onclick="ParSupabaseUI.copySchemaSql()" style="font-size:11.5px;">
            📋 Copy SQL Script to Clipboard
          </button>
          <a href="${sqlEditorUrl}" target="_blank" rel="noopener noreferrer" class="par-btn par-btn-sm par-btn-secondary" style="font-size:11.5px; text-decoration:none;">
            ↗️ Open Supabase SQL Editor
          </a>
        </div>
      `;
    } else {
      feedback.style.background = '#fff5f5';
      feedback.style.color = '#c53030';
      feedback.style.border = '1px solid #feb2b2';
      feedback.innerHTML = '❌ ' + res.message;
    }
  }

  async function saveSettingsFromModal() {
    const url = document.getElementById('sb_input_url').value.trim();
    const key = document.getElementById('sb_input_key').value.trim();

    if (!url || !key) {
      alert('Please enter both Supabase URL and Anon Key.');
      return;
    }

    window.ParSupabase.saveConfig(url, key);
    updateNavbarBadge();
    
    // Test automatically
    const res = await window.ParSupabase.testConnection(url, key);
    if (res.success) {
      alert('🎉 Connected to Supabase successfully!');
      if (typeof ParApp !== 'undefined' && ParApp.closeModal) {
        ParApp.closeModal();
      }
    } else {
      openModal();
      const feedback = document.getElementById('sb-test-feedback');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fffaf0';
        feedback.style.color = '#c05621';
        feedback.innerHTML = '⚠️ Credentials saved, but connection check returned: ' + res.message;
      }
    }
  }

  function disconnect() {
    if (confirm('Are you sure you want to disconnect Supabase? Local data will be preserved.')) {
      window.ParSupabase.clearConfig();
      updateNavbarBadge();
      openModal();
    }
  }

  async function syncAllLocalToCloud() {
    const feedback = document.getElementById('sb-sync-feedback');
    if (!feedback) return;
    feedback.style.display = 'block';
    feedback.style.color = '#2b6cb0';
    feedback.innerHTML = '⏳ Uploading local appraisal reports to Supabase...';

    const reports = window.ParStorage ? window.ParStorage.getReports() : [];
    let synced = 0;
    let failed = 0;

    for (const r of reports) {
      const res = await window.ParSupabase.syncReportToCloud(r);
      if (res.success) synced++;
      else failed++;
    }

    feedback.style.color = failed === 0 ? '#276749' : '#c05621';
    feedback.innerHTML = `✅ Successfully uploaded ${synced} report(s) to Supabase.${failed > 0 ? ` (${failed} failed)` : ''}`;
  }

  async function pullCloudToLocal() {
    const feedback = document.getElementById('sb-sync-feedback');
    if (!feedback) return;
    feedback.style.display = 'block';
    feedback.style.color = '#2b6cb0';
    feedback.innerHTML = '⏳ Pulling reports from Supabase cloud...';

    const res = await window.ParSupabase.fetchReportsFromCloud();
    if (!res.success) {
      feedback.style.color = '#c53030';
      feedback.innerHTML = '❌ Failed to fetch cloud reports: ' + (res.error || 'Unknown error');
      return;
    }

    const cloudReports = res.reports || [];
    if (cloudReports.length === 0) {
      feedback.style.color = '#4a5568';
      feedback.innerHTML = 'ℹ️ No reports found in cloud database.';
      return;
    }

    let mergedCount = 0;
    if (window.ParStorage) {
      const localReports = window.ParStorage.getReports();
      const map = new Map();
      localReports.forEach(r => map.set(r.id, r));
      cloudReports.forEach(r => {
        map.set(r.id, r);
        mergedCount++;
      });
      const mergedList = Array.from(map.values());
      try {
        localStorage.setItem('par_appraisal_reports_v1', JSON.stringify(mergedList));
      } catch (e) {
        console.warn('Storage save error:', e);
      }
    }

    feedback.style.color = '#276749';
    feedback.innerHTML = `✅ Downloaded and merged ${cloudReports.length} report(s) from Supabase!`;
    
    if (typeof ParApp !== 'undefined' && ParApp.renderDashboard) {
      ParApp.renderDashboard();
    }
  }

  const SCHEMA_SQL = `-- 1. PAR Reports Table
CREATE TABLE IF NOT EXISTS public.par_reports (
    id TEXT PRIMARY KEY,
    faculty_id TEXT,
    faculty_name TEXT NOT NULL,
    department TEXT,
    designation TEXT,
    academic_year TEXT NOT NULL,
    fpi NUMERIC(5, 3),
    status TEXT NOT NULL DEFAULT 'Draft',
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_par_reports_faculty_name ON public.par_reports(faculty_name);
CREATE INDEX IF NOT EXISTS idx_par_reports_academic_year ON public.par_reports(academic_year);
CREATE INDEX IF NOT EXISTS idx_par_reports_status ON public.par_reports(status);

-- 2. Designation Weights Configuration Table
CREATE TABLE IF NOT EXISTS public.par_weight_configs (
    id TEXT PRIMARY KEY,
    designation TEXT NOT NULL,
    faculty_category TEXT,
    w10 NUMERIC(4, 2) NOT NULL,
    w20 NUMERIC(4, 2) NOT NULL,
    w30 NUMERIC(4, 2) NOT NULL,
    w40 NUMERIC(4, 2) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
INSERT INTO public.par_weight_configs (id, designation, faculty_category, w10, w20, w30, w40, is_default, description)
VALUES 
    ('wt_asst_prof', 'ASSISTANT PROFESSOR', 'Engineering Faculty', 0.60, 0.15, 0.15, 0.10, true, 'Assistant Professor'),
    ('wt_assoc_prof', 'ASSOCIATE PROFESSOR', 'Engineering Faculty', 0.50, 0.20, 0.15, 0.15, false, 'Associate Professor'),
    ('wt_professor', 'PROFESSOR', 'Engineering Faculty', 0.40, 0.30, 0.15, 0.15, false, 'Professor')
ON CONFLICT (id) DO NOTHING;

-- 3. FPAS Form Records Table (700 Marks System)
CREATE TABLE IF NOT EXISTS public.fpas_records (
    id TEXT PRIMARY KEY,
    academic_year TEXT,
    faculty_name TEXT,
    empid TEXT,
    designation TEXT,
    department TEXT,
    form_data JSONB NOT NULL,
    total_awarded NUMERIC(6, 2),
    percentage NUMERIC(5, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.par_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.par_weight_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fpas_records ENABLE ROW LEVEL SECURITY;

-- 5. Open Access Policies
DROP POLICY IF EXISTS "Allow anon all on par_reports" ON public.par_reports;
CREATE POLICY "Allow anon all on par_reports" ON public.par_reports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on par_weight_configs" ON public.par_weight_configs;
CREATE POLICY "Allow anon all on par_weight_configs" ON public.par_weight_configs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on fpas_records" ON public.fpas_records;
CREATE POLICY "Allow anon all on fpas_records" ON public.fpas_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Storage Bucket for Appraisal Evidence Attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('appraisal-evidence', 'appraisal-evidence', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Allow public evidence uploads" ON storage.objects;
CREATE POLICY "Allow public evidence uploads" ON storage.objects FOR ALL TO anon, authenticated USING (bucket_id = 'appraisal-evidence') WITH CHECK (bucket_id = 'appraisal-evidence');
`;

  function copySchemaSql() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(SCHEMA_SQL).then(() => {
        alert('📋 SQL Schema copied to clipboard!\n\nNow open your Supabase Dashboard -> SQL Editor, paste and click Run.');
      }).catch(() => {
        fallbackCopyTextToClipboard(SCHEMA_SQL);
      });
    } else {
      fallbackCopyTextToClipboard(SCHEMA_SQL);
    }
  }

  function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      alert('📋 SQL Schema copied to clipboard!\n\nNow open your Supabase Dashboard -> SQL Editor, paste and click Run.');
    } catch (err) {
      alert('Please open supabase/schema.sql and copy the SQL code manually.');
    }
    document.body.removeChild(textArea);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', initUI);
  }

  return {
    initUI,
    openModal,
    testConnectionFromModal,
    saveSettingsFromModal,
    disconnect,
    syncAllLocalToCloud,
    pullCloudToLocal,
    updateNavbarBadge,
    copySchemaSql
  };
});
