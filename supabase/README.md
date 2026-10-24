# Supabase Cloud Setup Guide for MVIT Faculty Appraisal Portal

This portal includes built-in Supabase synchronization for cloud backup, multi-device access, and persistence of Faculty Appraisal Reports (PAR) and FPAS forms.

---

## 🚀 Quick Setup Instructions

### 1. Create a Supabase Project
1. Log in or sign up at [https://supabase.com](https://supabase.com).
2. Click **"New Project"**.
3. Set your project name (e.g. `mvit-faculty-appraisal`) and database password.
4. Select your nearest region (e.g. `South Asia (Mumbai)`).

---

### 2. Run Database Schema
1. In your Supabase dashboard, navigate to **SQL Editor** in the left sidebar.
2. Open or copy the contents of `supabase/schema.sql` from this repository.
3. Paste it into the SQL Editor and click **Run**.
4. This will create:
   - `par_reports`: Full structured PAR reports and calculations.
   - `par_weight_configs`: FPI weights per designation (Assistant Professor, Associate Professor, Professor).
   - `fpas_records`: 700-mark institutional appraisal forms.
   - `appraisal-evidence`: Storage bucket for document attachments.

---

### 3. Connect the Portal to Supabase
You can connect in either of two ways:

#### Option A: Via the Web Portal UI (Easiest)
1. Open the portal at [http://localhost:8000](http://localhost:8000).
2. Click the **"☁️ Supabase Cloud"** button in the top navigation bar.
3. In your Supabase Dashboard, go to **Project Settings** → **API**.
4. Copy:
   - **Project URL** (e.g. `https://your-project.supabase.co`)
   - **Project API Key (`anon` / `public`)**
5. Paste them into the modal and click **"Test Connection"**, then **"Save & Connect"**.

#### Option B: Via `js/supabase-config.js`
Open `js/supabase-config.js` and paste your project URL and anon key:
```javascript
window.MVIT_SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```
