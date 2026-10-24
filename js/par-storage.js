/**
 * Faculty Performance Appraisal Report (PAR) - Data Access Layer (DAL)
 * Handles LocalStorage persistence, IndexedDB evidence attachments,
 * default weight configurations, audit logging, and report lifecycles.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(require('./par-calc.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./par-calc.js'], factory);
  } else {
    root.ParStorage = factory(root.ParCalc);
  }
})(typeof self !== 'undefined' ? self : this, function (ParCalc) {
  'use strict';

  const STORAGE_KEYS = {
    REPORTS: 'par_appraisal_reports_v1',
    WEIGHT_CONFIGS: 'par_weight_configs_v1',
    CURRENT_ROLE: 'par_current_active_role_v1',
    SETTINGS: 'par_system_settings_v1'
  };

  // Default Designation Weight Configurations
  const DEFAULT_WEIGHT_CONFIGS = [
    {
      id: 'wt_asst_prof',
      designation: 'ASSISTANT PROFESSOR',
      facultyCategory: 'Engineering Faculty',
      w10: 0.60, // Academic
      w20: 0.15, // Research
      w30: 0.15, // Extension
      w40: 0.10, // Administration
      description: 'Standard weights for Assistant Professor (MVIT Reference Document)',
      isDefault: true,
      lastUpdated: '2024-06-19T00:00:00.000Z'
    },
    {
      id: 'wt_assoc_prof',
      designation: 'ASSOCIATE PROFESSOR',
      facultyCategory: 'Engineering Faculty',
      w10: 0.50,
      w20: 0.20,
      w30: 0.15,
      w40: 0.15,
      description: 'Standard weights for Associate Professor / Senior Assistant Professor',
      isDefault: false,
      lastUpdated: '2024-06-19T00:00:00.000Z'
    },
    {
      id: 'wt_professor',
      designation: 'PROFESSOR',
      facultyCategory: 'Engineering Faculty',
      w10: 0.40,
      w20: 0.30,
      w30: 0.15,
      w40: 0.15,
      description: 'Standard weights for Professor with higher Research emphasis',
      isDefault: false,
      lastUpdated: '2024-06-19T00:00:00.000Z'
    }
  ];

  // In-memory fallback if localStorage is unavailable (e.g. Node tests)
  let memoryStore = {};

  function getItem(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('localStorage not accessible, using memoryStore', e);
    }
    return memoryStore[key] || null;
  }

  function setItem(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn('localStorage set failed, using memoryStore', e);
    }
    memoryStore[key] = value;
  }

  // --- IndexedDB Evidence Manager for large attachments ---
  const DB_NAME = 'par_evidence_storage_v1';
  const STORE_NAME = 'evidence_files';
  let dbPromise = null;

  function getDB() {
    if (dbPromise) return dbPromise;
    if (typeof indexedDB === 'undefined') {
      dbPromise = Promise.resolve(null);
      return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('IndexedDB failed to open, falling back to in-memory/localStorage');
        resolve(null);
      };
    });
    return dbPromise;
  }

  /**
   * Save an evidence file blob/data
   */
  async function saveEvidenceFile(fileData) {
    const db = await getDB();
    if (db) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(fileData);
        tx.oncomplete = () => resolve(fileData.id);
        tx.onerror = () => reject(tx.error);
      });
    } else {
      // Memory/localStorage fallback for small/mock files
      memoryStore['file_' + fileData.id] = JSON.stringify(fileData);
      return fileData.id;
    }
  }

  /**
   * Get an evidence file by ID
   */
  async function getEvidenceFile(fileId) {
    const db = await getDB();
    if (db) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(fileId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } else {
      const raw = memoryStore['file_' + fileId];
      return raw ? JSON.parse(raw) : null;
    }
  }

  /**
   * Delete an evidence file
   */
  async function deleteEvidenceFile(fileId) {
    const db = await getDB();
    if (db) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(fileId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } else {
      delete memoryStore['file_' + fileId];
      return true;
    }
  }

  // --- Weight Configurations Management ---

  function getWeightConfigs() {
    const raw = getItem(STORAGE_KEYS.WEIGHT_CONFIGS);
    if (!raw) {
      saveWeightConfigs(DEFAULT_WEIGHT_CONFIGS);
      return JSON.parse(JSON.stringify(DEFAULT_WEIGHT_CONFIGS));
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULT_WEIGHT_CONFIGS));
    }
  }

  function saveWeightConfigs(configs) {
    setItem(STORAGE_KEYS.WEIGHT_CONFIGS, JSON.stringify(configs));
  }

  function getWeightConfigByDesignation(designation) {
    const configs = getWeightConfigs();
    if (!designation) return configs[0];
    const match = configs.find(c => c.designation.toUpperCase() === designation.trim().toUpperCase());
    return match || configs[0];
  }

  function updateWeightConfig(configData) {
    const weights = {
      w10: Number(configData.w10),
      w20: Number(configData.w20),
      w30: Number(configData.w30),
      w40: Number(configData.w40)
    };
    const validation = ParCalc.validateWeights(weights);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const configs = getWeightConfigs();
    const existingIndex = configs.findIndex(c => c.id === configData.id || c.designation.toUpperCase() === (configData.designation || '').toUpperCase());

    const updated = {
      id: configData.id || 'wt_' + Date.now(),
      designation: (configData.designation || 'CUSTOM').toUpperCase(),
      facultyCategory: configData.facultyCategory || 'Engineering Faculty',
      w10: weights.w10,
      w20: weights.w20,
      w30: weights.w30,
      w40: weights.w40,
      description: configData.description || 'Configured via Weight Management',
      lastUpdated: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      configs[existingIndex] = updated;
    } else {
      configs.push(updated);
    }

    saveWeightConfigs(configs);
    return { success: true, config: updated };
  }

  // --- Appraisal Reports Persistence & Query ---

  function getAllReports() {
    const raw = getItem(STORAGE_KEYS.REPORTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function saveAllReports(reports) {
    setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  }

  function getReportById(reportId) {
    const reports = getAllReports();
    return reports.find(r => r.id === reportId) || null;
  }

  /**
   * Create a new blank appraisal report
   */
  function createBlankReport(facultyData = {}) {
    const reportId = 'PAR-' + new Date().getFullYear() + '-' + String(Math.floor(1000 + Math.random() * 9000));
    const now = new Date().toISOString();
    const designation = facultyData.designation || 'ASSISTANT PROFESSOR';
    const wtConfig = getWeightConfigByDesignation(designation);

    return {
      id: reportId,
      academicYear: facultyData.academicYear || '2024-25',
      submissionDeadline: '10th OCT 2024',
      status: 'Draft', // Draft, Submitted for Verification, Returned for Correction, Resubmitted, Verified, Completed
      createdAt: now,
      updatedAt: now,
      facultyInfo: {
        name: facultyData.name || '',
        designation: designation,
        scaleOfPay: facultyData.scaleOfPay || '',
        dateOfAppointment: facultyData.dateOfAppointment || '',
        employeeId: facultyData.employeeId || '',
        department: facultyData.department || 'Computer Science & Engineering',
        email: facultyData.email || ''
      },
      // Section 1.0 Academic Activities
      academicActivities: {
        // 1.1.1 Semester Results
        courses111: [
          { id: 'c1', ugPg: 'UG', code: '', title: '', passPercent: '', gradePoint: '' }
        ],
        // 1.1.2 Students Feedback
        feedback112: [
          { id: 'f1', ugPg: 'UG', code: '', title: '', feedbackScore: '' }
        ],
        avgGradePointOverride: null,
        avgGradePointOverrideReason: '',
        avgFeedbackOverride: null,
        avgFeedbackOverrideReason: '',
        // 1.2 Related Development Activities
        relatedDev12: [
          { id: 'rd1', name: '', description: '', date: '', points: 0, evidenceId: null, evidenceName: '' }
        ],
        assignedPoints12: 0,
        // 1.3 Continuing Education
        continuingEd13: [
          { id: 'ce1', name: '', description: '', date: '', status: '', points: 0, evidenceId: null, evidenceName: '' }
        ],
        assignedPoints13: 0,
        index10: 0,
        index11: 0,
        index12: 0,
        index13: 0,
        breakdownText: ''
      },
      // Section 2.0 Research
      researchActivities: {
        projects21: [],
        points21: 0,
        sponsored22: [],
        points22: 0,
        publications23: [],
        points23: 0,
        patents24: [],
        points24: 0,
        sponsoredSeminars25: [],
        points25: 0,
        weights20: { w21: 0.1, w22: 0.2, w23: 0.3, w24: 0.2, w25: 0.2 },
        index20: 0,
        breakdownText: ''
      },
      // Section 3.0 Extension Activities
      extensionActivities: {
        activities30: [],
        index30: 0,
        assessmentBasis: 'Evaluated by rubric'
      },
      // Section 4.0 Administration
      adminActivities: {
        activities40: [],
        index40: 0,
        assessmentBasis: 'Evaluated by rubric'
      },
      // Section 5.0 FPI Computation
      fpiComputation: {
        weightConfigId: wtConfig.id,
        weights: {
          w10: wtConfig.w10,
          w20: wtConfig.w20,
          w30: wtConfig.w30,
          w40: wtConfig.w40
        },
        term1: 0,
        term2: 0,
        term3: 0,
        term4: 0,
        fpi: 0,
        formattedFpi: '0.000',
        formulaText: ''
      },
      // Section 6.0 Additional Information
      additionalInfo: '',
      // Faculty Declaration
      declaration: {
        confirmed: false,
        date: '',
        signatureName: ''
      },
      // Part B - Remarks of HOD
      hodVerification: {
        verified: null, // 'Yes' | 'No' | null
        verificationDate: '',
        hodName: '',
        remarks: '',
        rejectionReason: '',
        signatureName: ''
      },
      // Audit & Review History
      history: [
        {
          timestamp: now,
          action: 'Created',
          fromStatus: null,
          toStatus: 'Draft',
          by: 'Faculty Member',
          remarks: 'Appraisal draft initiated',
          fpiSnapshot: 0
        }
      ],
      evidenceFiles: []
    };
  }

  /**
   * Save or update an appraisal report
   */
  function saveReport(report) {
    if (!report || !report.id) {
      throw new Error('Invalid report object or missing report id');
    }

    report.updatedAt = new Date().toISOString();
    const reports = getAllReports();
    const index = reports.findIndex(r => r.id === report.id);

    if (index >= 0) {
      reports[index] = report;
    } else {
      reports.unshift(report);
    }

    saveAllReports(reports);

    // Asynchronous Cloud Sync if Supabase is configured
    try {
      if (typeof window !== 'undefined' && window.ParSupabase && window.ParSupabase.isConfigured()) {
        window.ParSupabase.syncReportToCloud(report).catch(err => {
          console.warn('[Supabase] Background sync failed:', err);
        });
      }
    } catch (e) {
      /* ignore background sync error */
    }

    return report;
  }

  /**
   * Delete an appraisal report (only permitted for Draft or by Administrator)
   */
  function deleteReport(reportId, role = 'faculty') {
    const reports = getAllReports();
    const report = reports.find(r => r.id === reportId);
    if (!report) return { success: false, error: 'Report not found' };

    if (report.status !== 'Draft' && role !== 'admin') {
      return { success: false, error: `Cannot delete report in status '${report.status}'. Only Drafts can be deleted.` };
    }

    const filtered = reports.filter(r => r.id !== reportId);
    saveAllReports(filtered);

    // Asynchronous Cloud Delete if Supabase is configured
    try {
      if (typeof window !== 'undefined' && window.ParSupabase && window.ParSupabase.isConfigured()) {
        window.ParSupabase.deleteReportFromCloud(reportId).catch(err => {
          console.warn('[Supabase] Background delete failed:', err);
        });
      }
    } catch (e) {
      /* ignore background delete error */
    }

    return { success: true };
  }

  /**
   * Transition Report Status with Audit Logging
   */
  function transitionStatus(reportId, targetStatus, userDetails = {}) {
    const report = getReportById(reportId);
    if (!report) return { success: false, error: 'Report not found' };

    const validStatuses = ['Draft', 'Submitted for Verification', 'Returned for Correction', 'Resubmitted', 'Verified', 'Completed'];
    if (!validStatuses.includes(targetStatus)) {
      return { success: false, error: `Invalid status: ${targetStatus}` };
    }

    const fromStatus = report.status;
    const now = new Date().toISOString();

    report.status = targetStatus;
    report.updatedAt = now;

    if (!Array.isArray(report.history)) {
      report.history = [];
    }

    report.history.push({
      timestamp: now,
      action: userDetails.action || `Status changed to ${targetStatus}`,
      fromStatus,
      toStatus: targetStatus,
      by: userDetails.by || 'User',
      remarks: userDetails.remarks || '',
      fpiSnapshot: report.fpiComputation ? report.fpiComputation.fpi : 0
    });

    saveReport(report);
    return { success: true, report };
  }

  /**
   * Recompute all report indices deterministically
   */
  function recalculateReport(report) {
    if (!report) return null;

    // 1.1 Teaching
    const courses = (report.academicActivities && report.academicActivities.courses111) || [];
    const feedbackRows = (report.academicActivities && report.academicActivities.feedback112) || [];

    const avgGpResult = ParCalc.calcAverageGradePoint(courses, 2);
    const avgFbResult = ParCalc.calcAverageFeedback(feedbackRows, 2);

    const i111 = report.academicActivities.avgGradePointOverride !== null && report.academicActivities.avgGradePointOverride !== undefined && report.academicActivities.avgGradePointOverride !== ''
      ? Number(report.academicActivities.avgGradePointOverride)
      : avgGpResult.average;

    const i112 = report.academicActivities.avgFeedbackOverride !== null && report.academicActivities.avgFeedbackOverride !== undefined && report.academicActivities.avgFeedbackOverride !== ''
      ? Number(report.academicActivities.avgFeedbackOverride)
      : avgFbResult.average;

    const teachingRes = ParCalc.calcTeachingIndex(i111, i112, 2);

    // 1.2 & 1.3
    const i12 = Number(report.academicActivities.assignedPoints12) || 0;
    const i13 = Number(report.academicActivities.assignedPoints13) || 0;

    const academicRes = ParCalc.calcAcademicIndex(teachingRes.value, i12, i13, 2);

    report.academicActivities.index111 = i111;
    report.academicActivities.index112 = i12;
    report.academicActivities.index11 = teachingRes.value;
    report.academicActivities.index12 = i12;
    report.academicActivities.index13 = i13;
    report.academicActivities.index10 = academicRes.value;
    report.academicActivities.breakdownText = academicRes.formulaText;

    // 2.0 Research
    const researchComp = {
      i21: Number(report.researchActivities.points21) || 0,
      i22: Number(report.researchActivities.points22) || 0,
      i23: Number(report.researchActivities.points23) || 0,
      i24: Number(report.researchActivities.points24) || 0,
      i25: Number(report.researchActivities.points25) || 0
    };
    const researchRes = ParCalc.calcResearchIndex(researchComp, report.researchActivities.weights20, 2);
    report.researchActivities.index20 = researchRes.value;
    report.researchActivities.breakdownText = researchRes.formulaText;

    // 3.0 Extension & 4.0 Administration
    const i30 = Number(report.extensionActivities.index30) || 0;
    const i40 = Number(report.adminActivities.index40) || 0;

    // 5.0 FPI
    const weights = report.fpiComputation.weights || { w10: 0.60, w20: 0.15, w30: 0.15, w40: 0.10 };
    const fpiRes = ParCalc.calcFpi(
      { i10: academicRes.value, i20: researchRes.value, i30, i40 },
      weights,
      3
    );

    if (fpiRes.valid) {
      report.fpiComputation.term1 = fpiRes.terms.term1;
      report.fpiComputation.term2 = fpiRes.terms.term2;
      report.fpiComputation.term3 = fpiRes.terms.term3;
      report.fpiComputation.term4 = fpiRes.terms.term4;
      report.fpiComputation.fpi = fpiRes.total;
      report.fpiComputation.formattedFpi = fpiRes.formatted;
      report.fpiComputation.formulaText = fpiRes.formulaText;
      report.fpiComputation.error = null;
    } else {
      report.fpiComputation.error = fpiRes.error;
    }

    return report;
  }

  /**
   * Reference Sample Data Loader (Suganya - Manakula Vinayagar Institute of Technology)
   * As specified in the reference Word document and screenshots (Expected FPI: 4.274)
   */
  function loadReferenceSampleReport() {
    const report = createBlankReport({
      name: 'P. Suganya',
      designation: 'ASSISTANT PROFESSOR',
      scaleOfPay: 'Rs.26500',
      dateOfAppointment: '19.06.2024',
      department: 'Computer Science & Engineering',
      academicYear: '2024-25'
    });

    report.id = 'PAR-2024-SAMPLE-SUGANYA';
    report.submissionDeadline = '10th OCT 2024';

    // 1.1.1 Semester Results
    report.academicActivities.courses111 = [
      { id: 'c1', ugPg: 'UG', code: 'AMPC303', title: 'Object Oriented Programming', passPercent: '92.98%', gradePoint: 3 },
      { id: 'c2', ugPg: 'UG', code: 'CSOE005', title: 'Linux Programming', passPercent: '94.64%', gradePoint: 4 },
      { id: 'c3', ugPg: 'UG', code: 'AMPC404', title: 'Artificial Intelligence', passPercent: '98.24%', gradePoint: 4 },
      { id: 'c4', ugPg: 'UG', code: 'AMPC401', title: 'Computer Organization & Architecture', passPercent: '96.43%', gradePoint: 4 }
    ];

    // In sample document: Average Grade Point is stated as 4 (override from arithmetic 3.75)
    report.academicActivities.avgGradePointOverride = 4;
    report.academicActivities.avgGradePointOverrideReason = 'Sample document rounding convention: Grade point 4';

    // 1.1.2 Students Feedback
    report.academicActivities.feedback112 = [
      { id: 'f1', ugPg: 'UG', code: 'AMPC303', title: 'Object Oriented Programming', feedbackScore: 4.44 },
      { id: 'f2', ugPg: 'UG', code: 'CSOE005', title: 'Linux Programming', feedbackScore: 4.22 },
      { id: 'f3', ugPg: 'UG', code: 'AMPC404', title: 'Artificial Intelligence', feedbackScore: 4.60 },
      { id: 'f4', ugPg: 'UG', code: 'AMPC401', title: 'Computer Organization & Architecture', feedbackScore: 4.37 }
    ];

    // In sample document: Average Feedback is stated as 4.60 (override from arithmetic 4.41)
    report.academicActivities.avgFeedbackOverride = 4.60;
    report.academicActivities.avgFeedbackOverrideReason = 'Sample document reference value: 4.60';

    // 1.2 Related Development Activities
    report.academicActivities.relatedDev12 = [
      { id: 'rd1', name: 'Blended Learning', description: 'Blended Learning approach practiced – ICT Tools Nearpod, Mentimeter, Kahoot – Quiz games Mind Map – Gitmind and draw.io', date: '2024-25', points: 1 },
      { id: 'rd2', name: 'Special Lectures', description: 'Delivered special lectures on: Medical Imaging and Visualization (09.08.2024), Role of Linux in Education (14.09.2024), AI in Precision Agriculture (26.03.2025), Sustainable Recycling (08.02.2025)', date: '2024-2025', points: 1 },
      { id: 'rd3', name: 'Industrial Visit', description: 'Organized Industrial Visit to Microsoft Bangalore for II Year Students on 22.02.2025', date: '22.02.2025', points: 0.5 },
      { id: 'rd4', name: 'Mini-Projects', description: 'Guided 7 Mini-Projects for 2nd & 3rd year students', date: '2024-25', points: 0.5 },
      { id: 'rd5', name: 'External Workshop', description: 'Organized an External Workshop “WebBased Framework Database Django” by Datanerdz from 22nd to 25th July 2024', date: '22-25 July 2024', points: 0.5 },
      { id: 'rd6', name: 'Online Certifications Guidance', description: 'Guided students to active participation in NPTEL, Simplilearn, Great Learning, Udemy', date: '2024-25', points: 0.5 },
      { id: 'rd7', name: 'Technical Competitions', description: 'Motivated 2 teams in Paper Presentation & Hackathon 2025; Third Year Students presented paper in ICS 1.0 MVIT', date: '2024-25', points: 0.5 },
      { id: 'rd8', name: 'Student Mentoring', description: 'Mentoring 28 students (2023-2027 batch): II Year A (14 students), II Year B (14 students)', date: '2024-25', points: 0.5 }
    ];
    report.academicActivities.assignedPoints12 = 5.0;

    // 1.3 Continuing Education
    report.academicActivities.continuingEd13 = [
      { id: 'ce1', name: 'NPTEL Online Course', description: 'Completed NPTEL online certification course on “Artificial Intelligence for Economics”', date: 'July-Dec 2024', status: 'Completed', points: 0.5 },
      { id: 'ce2', name: 'Certiport Certification', description: 'Completed Certiport certification on “Artificial Intelligence”', date: '29.11.2024', status: 'Completed', points: 0.5 },
      { id: 'ce3', name: 'ATAL Academy FDP', description: 'Attended ATAL Academy FDP on “Foundations and Applications of AI and Data Science”', date: '20-25 Jan 2025', status: 'Attended', points: 0.5 },
      { id: 'ce4', name: 'NIT Delhi ATAL FDP', description: 'Attended ATAL Academy FDP on “Generative AI: Techniques, Tools and Applications” at NIT Delhi', date: '03-08 Feb 2025', status: 'Attended', points: 0.5 },
      { id: 'ce5', name: 'FDP on Data Science', description: 'Participated in one week FDP on “Application of Data Science Analytics” by KG Reddy College', date: '01-06 Nov 2024', status: 'Attended', points: 0.5 },
      { id: 'ce6', name: 'IQAC PDP', description: 'Attended PDP on “ICT Tools for Interactive Teaching & Learning” by IQAC, MVIT', date: '22-27 Jul 2024', status: 'Attended', points: 0.5 },
      { id: 'ce7', name: 'Gen AI & ChatGPT FDP', description: 'Attended 5 Day’s online FDP on “Gen AI & ChatGPT Application in Industry” by Bharti Vidyapeeth College', date: '27-31 Jan 2025', status: 'Attended', points: 0.5 },
      { id: 'ce8', name: 'Advanced Engineering FDP', description: 'Participated in one week FDP on “Emerging Trends in Advanced Engineering Research” by Sree Sakthi Engg College', date: '01-06 Jul 2024', status: 'Attended', points: 0.5 },
      { id: 'ce9', name: 'Virtual FDP', description: 'Participated in one week Virtual FDP on “Transforming Research through Advanced Technology” by SRM IST', date: '24-26 Jan 2025', status: 'Attended', points: 0.5 },
      { id: 'ce10', name: 'Faculty Industrial Visit', description: 'Faculty Industrial visit attended “Touch Energy”, Ariyankuppam, Puducherry', date: '27.12.2024', status: 'Attended', points: 0.25 },
      { id: 'ce11', name: 'IIC Levels', description: 'Completed IIC Basic and Advanced levels', date: '2024-25', status: 'Completed', points: 0.25 }
    ];
    report.academicActivities.assignedPoints13 = 5.0;

    // 2.0 Research Activities
    // 2.1 Project Guidance
    report.researchActivities.projects21 = [
      { id: 'p1', ugPg: 'UG', title: 'Coral Reef Pollution Forecasting using Multimodal Fusion', otherDetails: 'Final Year Major' },
      { id: 'p2', ugPg: 'UG', title: 'Gesture to Text Conversion CNN Powered framework for Sign Language Recognition', otherDetails: 'Mini Project' },
      { id: 'p3', ugPg: 'UG', title: 'Sustainable Shopping Assistant System', otherDetails: 'Mini Project' },
      { id: 'p4', ugPg: 'UG', title: 'ProxSense Algorithm Driven Contactless Switching', otherDetails: 'Mini Project' },
      { id: 'p5', ugPg: 'UG', title: 'Money Expense Tracker Smart Financial Management System', otherDetails: 'Mini Project' },
      { id: 'p6', ugPg: 'UG', title: 'Food Sharing Community Platform using Machine Learning', otherDetails: 'Mini Project' },
      { id: 'p7', ugPg: 'UG', title: 'Lumosense Smart Motion Activated Lighting System', otherDetails: 'Mini Project' }
    ];
    report.researchActivities.points21 = 1;

    // 2.2 Sponsored Research / Programmes
    report.researchActivities.sponsored22 = [];
    report.researchActivities.points22 = 0;

    // 2.3 Publications / International Certification
    report.researchActivities.publications23 = [
      {
        id: 'pub1',
        title: 'Coral Reef Pollution Forecasting using Multimodal Fusion',
        publicationDetails: 'Taylor & Francis-Scopus Indexed International Conference CVCNCE2025, Francis Xavier Engg College',
        authors: 'P. Suganya',
        date: 'Dec 2025 (Accepted)',
        status: 'Accepted',
        indexing: 'Scopus',
        doi: ''
      },
      {
        id: 'pub2',
        title: 'Gesture to Text Conversion CNN Powered framework for Sign Language Recognition',
        publicationDetails: 'Taylor & Francis Scopus Indexed International Conference CVCNCE2025, Francis Xavier Engg College',
        authors: 'P. Suganya',
        date: 'Dec 2025 (Accepted)',
        status: 'Accepted',
        indexing: 'Scopus',
        doi: ''
      },
      {
        id: 'pub3',
        title: 'Cloud air shield using Random forest',
        publicationDetails: 'Presented in ICS 1.0 by MVIT, Puducherry',
        authors: 'P. Suganya',
        date: '29.11.2024',
        status: 'Presented',
        indexing: 'Conference',
        doi: ''
      }
    ];
    report.researchActivities.points23 = 3;

    // 2.4 Innovative Products / Patents
    report.researchActivities.patents24 = [
      {
        id: 'pat1',
        title: 'ProxSense Algorithm Driven Contactless Switching',
        description: 'Product Patent Filed for Contactless Switching Technology',
        status: 'Filed',
        date: '2024-25',
        refNumber: 'Filed'
      }
    ];
    report.researchActivities.points24 = 2;

    // 2.5 Sponsored Seminars / FDPs
    report.researchActivities.sponsoredSeminars25 = [
      {
        id: 'sem1',
        title: 'One week Faculty Development Programme under AICTE ATAL Academy on “Research Opportunities in Data Science and Data Analytics”',
        agency: 'AICTE ATAL Academy',
        date: '20-25 Jan 2025',
        details: 'Conducted at MVIT',
        status: 'Sanctioned'
      }
    ];
    report.researchActivities.points25 = 2;

    // 3.0 Extension Activities
    report.extensionActivities.activities30 = [
      { id: 'ext1', name: 'Student Motivation', description: 'Motivate the students participated in Paper presentation and various Activity', date: '2024-25', contribution: 'Mentoring and coordination' },
      { id: 'ext2', name: 'Industrial Visit', description: 'Organized Industrial Visit for II Year students “Microsoft Azure” Bangalore', date: '22.02.2025', contribution: 'Visit coordinator' },
      { id: 'ext3', name: 'Event Coordination', description: 'Coordinated Events in MITILENCE 2025-Slytherin', date: '2025', contribution: 'Faculty in charge' },
      { id: 'ext4', name: 'External Workshop', description: 'Organized External Workshop on “WebBased Framework Database DJango” by Datanerdz', date: '22-25 Jul 2024', contribution: 'Organizer' },
      { id: 'ext5', name: 'Conference Presentation', description: 'Presented paper on “Cloud air shield using Random forest” in ICS1.0 by MVIT', date: '29.11.2024', contribution: 'Presenter' },
      { id: 'ext6', name: 'Online Educational Content', description: 'Posted Youtube lecture video on topics Linux Interprocess Communication', date: '2024-25', contribution: 'Content Creator' }
    ];
    report.extensionActivities.index30 = 5.0;

    // 4.0 Administration
    report.adminActivities.activities40 = [
      { id: 'adm1', role: 'Class Advisor', description: 'Class Advisor – II year B', period: '2024-25', contribution: 'Student counseling, attendance, academic tracking' },
      { id: 'adm2', role: 'Website Coordinator', description: 'Department Website Coordinator', period: '2024-25', contribution: 'Website updates, content upload' },
      { id: 'adm3', role: 'QC Feedback Coordinator', description: 'Department QC Feedback Coordinator', period: '2024-25', contribution: 'Feedback collection and analysis' },
      { id: 'adm4', role: 'BOS Member', description: 'Department BOS Member', period: '2024-25', contribution: 'Curriculum review' },
      { id: 'adm5', role: 'NAAC Documentation', description: 'Assisting NAAC Criteria 5 files', period: '2024-25', contribution: 'Documentation support' },
      { id: 'adm6', role: 'IIC Member', description: 'Institution Innovation Council Member', period: '2024-25', contribution: 'Innovation activities coordination' }
    ];
    report.adminActivities.index40 = 5.0;

    // Faculty Declaration
    report.declaration = {
      confirmed: true,
      date: '18.11.2025',
      signatureName: 'P. Suganya'
    };

    // HOD Verification
    report.hodVerification = {
      verified: 'Yes',
      verificationDate: '18.11.2025',
      hodName: 'Dr. Head of Department',
      remarks: 'Verified the information provided in Part A and copies of documents. Recommended.',
      signatureName: 'Dr. Head of Department'
    };

    report.status = 'Verified';

    // Recalculate deterministic scores
    recalculateReport(report);

    return report;
  }

  // Initialize sample data if storage is completely empty
  function initializeStorage() {
    const existing = getAllReports();
    if (existing.length === 0) {
      const sample = loadReferenceSampleReport();
      saveReport(sample);
    }
  }

  return {
    STORAGE_KEYS,
    DEFAULT_WEIGHT_CONFIGS,
    getWeightConfigs,
    saveWeightConfigs,
    getWeightConfigByDesignation,
    updateWeightConfig,
    getAllReports,
    saveAllReports,
    getReportById,
    createBlankReport,
    saveReport,
    deleteReport,
    transitionStatus,
    recalculateReport,
    loadReferenceSampleReport,
    initializeStorage,
    saveEvidenceFile,
    getEvidenceFile,
    deleteEvidenceFile
  };
});
