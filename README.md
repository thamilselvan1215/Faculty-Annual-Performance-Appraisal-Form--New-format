# Faculty Performance Appraisal Portal

A unified, institutional web application hosting two distinct Faculty Performance Appraisal systems for **Manakula Vinayagar Institute of Technology**:

1. **Faculty Annual Performance Appraisal Form (FPAS — 700 Marks)** (Existing Module)
2. **Faculty Performance Appraisal Report (PAR — FPI System)** (New Module)

---

## 🏛️ System Overview

The application features a seamless top-level module switcher allowing authorized faculty, department heads, and administrators to access both appraisal frameworks without losing in-memory data, entered values, or calculations.

### Module 1: Faculty Annual Performance Appraisal Form (FPAS)
- **Scoring Framework**: 700 marks total across 8 institutional contribution areas (Academic, Student Centric, Faculty Self Development, R&D, Extension, Department Centric, Institution Centric, and Awards/Achievements).
- **Core Functions**: Real-time score validation, maximum score capping, automatic section tallying (`calcTotals()`), percentage calculation (`calcPct()`), and print-exact paper layout.

### Module 2: Faculty Performance Appraisal Report (PAR)
- **Scoring Framework**: Faculty Performance Index (FPI) based on the official Manakula Vinayagar Institute of Technology multi-part self-appraisal document.
- **Part A: Self Appraisal**:
  - **1.0 Academic Activities (I 1.0)**:
    - 1.1 Teaching: Theory Course Semester Results (`I 1.1.1`) & Student Feedback (`I 1.1.2`).
    - Teaching Index: `I 1.1 = (0.7 × I 1.1.1) + (0.3 × I 1.1.2)`.
    - 1.2 Related Development Activities (`I 1.2`): Blended learning, special lectures, industrial visits, mini-projects, workshops, mentoring.
    - 1.3 Continuing Education (`I 1.3`): NPTEL, certifications, ATAL Academy FDPs, PDPs.
    - Academic Index: `I 1.0 = (0.5 × I 1.1) + (0.3 × I 1.2) + (0.2 × I 1.3)`.
  - **2.0 Research (I 2.0)**:
    - 2.1 Project Guidance (`I 2.1`), 2.2 Sponsored Research (`I 2.2`), 2.3 Publications & Certifications (`I 2.3`), 2.4 Innovative Products & Patents (`I 2.4`), 2.5 Sponsored Seminars (`I 2.5`).
    - Research Index (Engineering Faculty): `I 2.0 = (0.1 × I 2.1) + (0.2 × I 2.2) + (0.3 × I 2.3) + (0.2 × I 2.4) + (0.2 × I 2.5)`.
  - **3.0 Extension Activities (I 3.0)**: Repeatable activities table and rubric-based index.
  - **4.0 Administration (I 4.0)**: Department and institutional responsibilities (Class Advisor, Website Coordinator, QC Feedback Coordinator, BOS Member, NAAC Criteria 5, IIC Member).
  - **5.0 Faculty Performance Index (FPI)**:
    - Formula: `FPI = (W 1.0 × I 1.0) + (W 2.0 × I 2.0) + (W 3.0 × I 3.0) + (W 4.0 × I 4.0)`.
    - Assistant Professor Weights: `W1.0 = 0.60, W2.0 = 0.15, W3.0 = 0.15, W4.0 = 0.10`.
    - Reference validation: `I1.0 = 4.59, I2.0 = 1.80, I3.0 = 5.00, I4.0 = 5.00` yields **FPI = 4.274**.
  - **6.0 Additional Information & Faculty Declaration**: Supporting claims and formal declaration.
- **Part B: Head of Department (HOD) Verification**:
  - Section 7.0 Verification of Information (Yes / No).
  - Section 8.0 HOD Remarks, signature, and date.
  - Approval moves status to `Verified`.
  - Rejection requires mandatory remarks, moving status to `Returned for Correction`. Faculty can update and resubmit (`Resubmitted`) while preserving the complete audit trail.
- **Print & PDF Export**: Exact reproduction of the official 7-page institutional paper format with clean typography, bordered tables, mathematical formula breakdowns, and signature lines.

---

## 📁 Project Architecture

```
anual_form/
├── Faculty_Appraisal_Form.html     # Unified portal & FPAS module entry point
├── index.html                      # Standard web entry point
├── css/
│   └── par.css                     # Responsive design system & print styles for PAR
├── js/
│   ├── par-calc.js                 # Pure deterministic mathematical calculation engine
│   ├── par-storage.js              # Persistence (LocalStorage & IndexedDB for evidence)
│   ├── par-app.js                  # PAR dashboard, editor, repeater, and HOD controller
│   └── module-switcher.js          # Top navbar & seamless module switcher
├── test/
│   └── par-test.js                 # Automated unit and regression test suite
└── README.md                       # Documentation
```

---

## 🧪 Automated Testing

Run the built-in Node.js automated test suite:

```bash
node --test test/par-test.js
```

### Verified Test Cases:
1. Module creation and blank report structure.
2. Faculty information and repeatable activity records save and reload correctly.
3. Adding, editing, and deleting activity rows without data loss.
4. Academic Index formula verification (`I 1.1` and `I 1.0`).
5. Research Index formula with official weights (`0.1, 0.2, 0.3, 0.2, 0.2`).
6. FPI exact calculation (`4.274` for reference inputs).
7. Weight configurations isolation and designation validation.
8. Missing configuration and invalid weights reporting.
9. Transparent arithmetic average calculation and source discrepancy handling.
10. Input validation (bounds, numeric constraints, negative weights).
11. Supporting evidence file metadata and IndexedDB association.
12. HOD verification workflow (approval, return for correction, resubmission, audit history).
13. Reference sample loader reproducing full 7-page document state.
14. HTML entry points synchronization.
15. Existing FPAS calculations (700 marks denominator) preservation.

---

## 🚀 Running the Application

Simply open `index.html` or `Faculty_Appraisal_Form.html` in any modern web browser, or serve locally:

```bash
python -m http.server 8085
```
Then navigate to: `http://localhost:8085/`
