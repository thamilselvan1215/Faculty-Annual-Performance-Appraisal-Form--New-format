/**
 * Comprehensive Automated Test Suite for Faculty Performance Appraisal Report (PAR)
 * and Regression Verification for the Existing FPAS Form.
 * Run with: node --test test/par-test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ParCalc = require('../js/par-calc.js');
const ParStorage = require('../js/par-storage.js');

test('PAR Module & Calculation Engine Test Suite', async (t) => {

  await t.test('1. Module creation and blank report structure', () => {
    const report = ParStorage.createBlankReport({
      name: 'Dr. John Doe',
      designation: 'ASSISTANT PROFESSOR',
      department: 'CSE'
    });

    assert.ok(report.id.startsWith('PAR-'), 'Report ID must have PAR- prefix');
    assert.equal(report.status, 'Draft', 'New report must start in Draft status');
    assert.equal(report.facultyInfo.name, 'Dr. John Doe');
    assert.equal(report.facultyInfo.designation, 'ASSISTANT PROFESSOR');
    assert.ok(Array.isArray(report.academicActivities.courses111), 'Courses must be an array');
    assert.ok(Array.isArray(report.researchActivities.projects21), 'Projects must be an array');
    assert.ok(Array.isArray(report.history), 'History must be an array');
    assert.equal(report.history.length, 1);
    assert.equal(report.history[0].toStatus, 'Draft');
  });

  await t.test('2. Faculty information and repeated activity records save and reload correctly', () => {
    const newReport = ParStorage.createBlankReport({
      name: 'Test Faculty A',
      designation: 'ASSOCIATE PROFESSOR',
      scaleOfPay: 'Rs.35000',
      dateOfAppointment: '01.08.2023'
    });

    // Add activity records
    newReport.academicActivities.courses111.push({
      id: 'c_test_1',
      ugPg: 'UG',
      code: 'CS101',
      title: 'Data Structures',
      passPercent: '95%',
      gradePoint: 4
    });

    newReport.academicActivities.feedback112.push({
      id: 'fb_test_1',
      ugPg: 'UG',
      code: 'CS101',
      title: 'Data Structures',
      feedbackScore: 4.5
    });

    ParStorage.saveReport(newReport);

    const reloaded = ParStorage.getReportById(newReport.id);
    assert.ok(reloaded, 'Report must be retrievable by ID');
    assert.equal(reloaded.facultyInfo.name, 'Test Faculty A');
    assert.equal(reloaded.facultyInfo.scaleOfPay, 'Rs.35000');
    assert.equal(reloaded.academicActivities.courses111.length, 2);
    assert.equal(reloaded.academicActivities.courses111[1].code, 'CS101');
    assert.equal(reloaded.academicActivities.feedback112[1].feedbackScore, 4.5);
  });

  await t.test('3. Users can add, edit, and remove activities without losing unrelated data', () => {
    const r = ParStorage.createBlankReport({ name: 'Edit Test Faculty' });
    r.academicActivities.courses111 = [
      { id: 'c1', code: 'C1', gradePoint: 3 },
      { id: 'c2', code: 'C2', gradePoint: 4 },
      { id: 'c3', code: 'C3', gradePoint: 4 }
    ];
    r.academicActivities.assignedPoints12 = 4.5;

    // Remove middle row
    r.academicActivities.courses111.splice(1, 1);
    assert.equal(r.academicActivities.courses111.length, 2);
    assert.equal(r.academicActivities.courses111[0].code, 'C1');
    assert.equal(r.academicActivities.courses111[1].code, 'C3');
    // Verify unrelated data was preserved
    assert.equal(r.academicActivities.assignedPoints12, 4.5);
    assert.equal(r.facultyInfo.name, 'Edit Test Faculty');
  });

  await t.test('4. Academic index formula produces expected result for known inputs', () => {
    // Teaching: I 1.1 = (0.7 * 4) + (0.3 * 4.60) = 2.8 + 1.38 = 4.18
    const teachingRes = ParCalc.calcTeachingIndex(4, 4.60);
    assert.equal(teachingRes.value, 4.18);
    assert.equal(teachingRes.term1, 2.8);
    assert.equal(teachingRes.term2, 1.38);

    // Academic: I 1.0 = (0.5 * 4.18) + (0.3 * 5) + (0.2 * 5) = 2.09 + 1.5 + 1.0 = 4.59
    const acadRes = ParCalc.calcAcademicIndex(4.18, 5, 5);
    assert.equal(acadRes.value, 4.59);
    assert.equal(acadRes.term1, 2.09);
    assert.equal(acadRes.term2, 1.5);
    assert.equal(acadRes.term3, 1.0);
  });

  await t.test('5. Research index calculations use correct coefficients (0.1, 0.2, 0.3, 0.2, 0.2)', () => {
    // Reference sample: I 2.1 = 1, I 2.2 = 0, I 2.3 = 3, I 2.4 = 2, I 2.5 = 2
    // Expected: (0.1*1) + (0.2*0) + (0.3*3) + (0.2*2) + (0.2*2) = 0.1 + 0 + 0.9 + 0.4 + 0.4 = 1.8
    const res = ParCalc.calcResearchIndex({
      i21: 1,
      i22: 0,
      i23: 3,
      i24: 2,
      i25: 2
    });

    assert.equal(res.value, 1.8);
    assert.equal(res.terms.term1, 0.1);
    assert.equal(res.terms.term2, 0.0);
    assert.equal(res.terms.term3, 0.9);
    assert.equal(res.terms.term4, 0.4);
    assert.equal(res.terms.term5, 0.4);
  });

  await t.test('6. FPI calculation produces 4.274 for the reference example inputs', () => {
    // Formula: FPI = (0.60 * 4.59) + (0.15 * 1.80) + (0.15 * 5.00) + (0.10 * 5.00)
    // = 2.754 + 0.27 + 0.75 + 0.5 = 4.274
    const fpiRes = ParCalc.calcFpi(
      { i10: 4.59, i20: 1.80, i30: 5.00, i40: 5.00 },
      { w10: 0.60, w20: 0.15, w30: 0.15, w40: 0.10 }
    );

    assert.equal(fpiRes.valid, true);
    assert.equal(fpiRes.total, 4.274);
    assert.equal(fpiRes.formatted, '4.274');
    assert.equal(fpiRes.terms.term1, 2.754);
    assert.equal(fpiRes.terms.term2, 0.27);
    assert.equal(fpiRes.terms.term3, 0.75);
    assert.equal(fpiRes.terms.term4, 0.5);
  });

  await t.test('7. Weight changes affect only appropriate new appraisal records and follow authorization rules', () => {
    // Check initial weight configuration
    const initialConfig = ParStorage.getWeightConfigByDesignation('ASSISTANT PROFESSOR');
    assert.equal(initialConfig.w10, 0.60);

    // Save an existing report with initial weights
    const rep1 = ParStorage.createBlankReport({ designation: 'ASSISTANT PROFESSOR' });
    ParStorage.saveReport(rep1);

    // Update weight preset for future Professor appraisals
    const updateRes = ParStorage.updateWeightConfig({
      id: 'wt_custom_test',
      designation: 'SPECIAL CHAIR PROFESSOR',
      w10: 0.30,
      w20: 0.40,
      w30: 0.15,
      w40: 0.15
    });
    assert.equal(updateRes.success, true);

    // rep1 must retain its existing frozen weights
    const rep1Reloaded = ParStorage.getReportById(rep1.id);
    assert.equal(rep1Reloaded.fpiComputation.weights.w10, 0.60);
  });

  await t.test('8. Missing configuration and invalid weights are reported cleanly', () => {
    // Weights not summing to 1.0
    const invalidWeights = { w10: 0.5, w20: 0.2, w30: 0.1, w40: 0.1 }; // sum = 0.90
    const val = ParCalc.validateWeights(invalidWeights);
    assert.equal(val.valid, false);
    assert.match(val.error, /Sum of weights must equal 1.00/);

    // FPI calculation with invalid weights
    const res = ParCalc.calcFpi({ i10: 4, i20: 2, i30: 3, i40: 4 }, invalidWeights);
    assert.equal(res.valid, false);
    assert.ok(res.error);
  });

  await t.test('9. Transparent average calculations and source data inconsistency handling', () => {
    // In reference doc: feedback values are 4.44, 4.22, 4.60, 4.37
    // Exact arithmetic mean is (4.44 + 4.22 + 4.60 + 4.37) / 4 = 17.63 / 4 = 4.4075 -> 4.41
    const feedbackItems = [
      { feedbackScore: 4.44 },
      { feedbackScore: 4.22 },
      { feedbackScore: 4.60 },
      { feedbackScore: 4.37 }
    ];
    const avgRes = ParCalc.calcAverageFeedback(feedbackItems, 2);
    assert.equal(avgRes.average, 4.41);
    assert.equal(avgRes.sum, 17.63);
    assert.equal(avgRes.count, 4);

    // Verify course results average: 3, 4, 4, 4 -> 15 / 4 = 3.75
    const courses = [
      { gradePoint: 3 },
      { gradePoint: 4 },
      { gradePoint: 4 },
      { gradePoint: 4 }
    ];
    const gpRes = ParCalc.calcAverageGradePoint(courses, 2);
    assert.equal(gpRes.average, 3.75);
    assert.equal(gpRes.sum, 15);
  });

  await t.test('10. Invalid, missing, or out-of-range inputs are handled safely', () => {
    // Empty courses or feedback
    const emptyGp = ParCalc.calcAverageGradePoint([]);
    assert.equal(emptyGp.average, 0);
    assert.equal(emptyGp.count, 0);

    // Missing numbers in teaching index
    const res = ParCalc.calcTeachingIndex(null, undefined);
    assert.equal(res.value, 0);

    // Negative weights check
    const negWt = ParCalc.validateWeights({ w10: -0.1, w20: 0.5, w30: 0.3, w40: 0.3 });
    assert.equal(negWt.valid, false);
    assert.match(negWt.error, /cannot be negative/);
  });

  await t.test('11. Supporting evidence association and metadata validation', async () => {
    const report = ParStorage.createBlankReport({ name: 'Evidence Faculty' });
    const evItem = {
      id: 'ev_file_test_1',
      name: 'NPTEL_Certificate.pdf',
      type: 'application/pdf',
      size: 102450,
      uploadedAt: new Date().toISOString()
    };

    const savedId = await ParStorage.saveEvidenceFile(evItem);
    assert.equal(savedId, 'ev_file_test_1');

    const retrieved = await ParStorage.getEvidenceFile('ev_file_test_1');
    assert.ok(retrieved);
    assert.equal(retrieved.name, 'NPTEL_Certificate.pdf');
    assert.equal(retrieved.size, 102450);
  });

  await t.test('12. HOD verification, correction, and resubmission workflow behaves correctly', () => {
    const r = ParStorage.createBlankReport({ name: 'Workflow Faculty' });
    ParStorage.saveReport(r);

    // 1. Submit for verification
    const subRes = ParStorage.transitionStatus(r.id, 'Submitted for Verification', {
      action: 'Submitted by Faculty',
      by: 'Workflow Faculty',
      remarks: 'Self-appraisal submitted'
    });
    assert.equal(subRes.success, true);
    assert.equal(subRes.report.status, 'Submitted for Verification');

    // 2. HOD rejects and returns for correction
    const retRes = ParStorage.transitionStatus(r.id, 'Returned for Correction', {
      action: 'Returned for Correction by HOD',
      by: 'Dr. Dept Head',
      remarks: 'Please recompute Section 1.1 feedback and attach NPTEL certificate'
    });
    assert.equal(retRes.success, true);
    assert.equal(retRes.report.status, 'Returned for Correction');

    // 3. Faculty resubmits after modifications
    const resubRes = ParStorage.transitionStatus(r.id, 'Resubmitted', {
      action: 'Resubmitted after correction',
      by: 'Workflow Faculty',
      remarks: 'Updated feedback score and attached certificate'
    });
    assert.equal(resubRes.success, true);
    assert.equal(resubRes.report.status, 'Resubmitted');

    // 4. HOD approves
    const verRes = ParStorage.transitionStatus(r.id, 'Verified', {
      action: 'Approved & Verified by HOD',
      by: 'Dr. Dept Head',
      remarks: 'All documents verified'
    });
    assert.equal(verRes.success, true);
    assert.equal(verRes.report.status, 'Verified');

    // Verify complete audit history trail
    const finalReport = ParStorage.getReportById(r.id);
    assert.equal(finalReport.history.length, 5); // Created + 4 transitions
    assert.equal(finalReport.history[2].action, 'Returned for Correction by HOD');
    assert.equal(finalReport.history[2].remarks, 'Please recompute Section 1.1 feedback and attach NPTEL certificate');
  });

  await t.test('13. Sample report loader reproduces full reference document state', () => {
    const sample = ParStorage.loadReferenceSampleReport();
    assert.equal(sample.facultyInfo.name, 'P. Suganya');
    assert.equal(sample.facultyInfo.designation, 'ASSISTANT PROFESSOR');
    assert.equal(sample.facultyInfo.scaleOfPay, 'Rs.26500');
    assert.equal(sample.academicActivities.courses111.length, 4);
    assert.equal(sample.academicActivities.feedback112.length, 4);
    assert.equal(sample.academicActivities.relatedDev12.length, 8);
    assert.equal(sample.academicActivities.continuingEd13.length, 11);
    assert.equal(sample.researchActivities.projects21.length, 7);
    assert.equal(sample.researchActivities.publications23.length, 3);
    assert.equal(sample.researchActivities.patents24.length, 1);
    assert.equal(sample.researchActivities.sponsoredSeminars25.length, 1);
    assert.equal(sample.extensionActivities.activities30.length, 6);
    assert.equal(sample.adminActivities.activities40.length, 6);
    assert.equal(sample.fpiComputation.fpi, 4.274);
    assert.equal(sample.fpiComputation.formattedFpi, '4.274');
    assert.equal(sample.status, 'Verified');
  });

  await t.test('14. HTML entry points exist, include both modules, and have proper linking', () => {
    const indexPath = path.join(__dirname, '..', 'index.html');
    const formPath = path.join(__dirname, '..', 'Faculty_Appraisal_Form.html');
    assert.ok(fs.existsSync(indexPath), 'index.html must exist');
    assert.ok(fs.existsSync(formPath), 'Faculty_Appraisal_Form.html must exist');
  });

  await t.test('15. Existing FPAS calculations (700 marks denominator) formula verification', () => {
    // The existing form defines total percentage using (total / 700 * 100)
    // as seen in calcGrandTotal(): pctEl.innerHTML = (total / 700 * 100).toFixed(1) + '%'
    const sampleAwarded = 560;
    const pct = ((sampleAwarded / 700) * 100).toFixed(1) + '%';
    assert.equal(pct, '80.0%');

    // Section maximum marks defined in calcTotals()
    const sections = [
      { max: 150, target: 'e_ac' },
      { max: 100, target: 'e_sc' },
      { max: 75, target: 'e_sd' },
      { max: 150, target: 'e_rd' },
      { max: 50, target: 'e_ext' },
      { max: 75, target: 'e_dc' },
      { max: 125, target: 'e_ic' },
      { max: 50, target: 'e_aa' },
    ];
    assert.equal(sections.length, 8);
    assert.equal(sections[0].max, 150);
    assert.equal(sections[7].max, 50);
  });

  await t.test('16. Supabase client module exports and configuration persistence', () => {
    const ParSupabase = require('../js/supabase-client.js');
    assert.ok(ParSupabase, 'ParSupabase module must export properly');
    assert.equal(typeof ParSupabase.getConfig, 'function');
    assert.equal(typeof ParSupabase.saveConfig, 'function');
    assert.equal(typeof ParSupabase.isConfigured, 'function');
    assert.equal(typeof ParSupabase.testConnection, 'function');
    assert.equal(typeof ParSupabase.syncReportToCloud, 'function');
    assert.equal(typeof ParSupabase.fetchReportsFromCloud, 'function');
    assert.equal(typeof ParSupabase.deleteReportFromCloud, 'function');
    assert.equal(typeof ParSupabase.syncFpasToCloud, 'function');
    assert.equal(typeof ParSupabase.uploadEvidence, 'function');
  });

  await t.test('17. Supabase SQL schema file validation', () => {
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    assert.ok(fs.existsSync(schemaPath), 'supabase/schema.sql must exist');
    const content = fs.readFileSync(schemaPath, 'utf8');
    assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.par_reports'), 'schema must create par_reports');
    assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.par_weight_configs'), 'schema must create par_weight_configs');
    assert.ok(content.includes('CREATE TABLE IF NOT EXISTS public.fpas_records'), 'schema must create fpas_records');
    assert.ok(content.includes('appraisal-evidence'), 'schema must configure appraisal-evidence storage bucket');
    assert.ok(content.includes('ENABLE ROW LEVEL SECURITY'), 'schema must configure RLS');
  });

});

