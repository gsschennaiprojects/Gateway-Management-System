# Google Sheets 4-Branch Tabular Schema Specification

**Gateway Software Solutions (GSS) Management System**  
**Document ID:** `DOC-DB-002`  
**Classification:** Enterprise Tabular Data Specification  
**Status:** Production Ready  
**Last Updated:** 2026-09-30  

---

## 1. Multi-Branch Spreadsheet Ecosystem

Operational tabular reporting is structured across **exactly 4 independent Google Spreadsheets** (1 per operational branch):

* **Chennai Branch (`CHN`):** `1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY`
* **Coimbatore Branch (`CBE`):** `1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA`
* **Madurai Branch (`MDU`):** `1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8`
* **Erode Branch (`ERD`):** `1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY`

> **Architectural Rule:** Employees do **not** receive separate standalone spreadsheet files. All operational records reside in sub-sheets inside the corresponding branch spreadsheet.

---

## 2. Common Master Tabs Specification

### 2.1 Tab: `02_Staff_Directory`
Maintains the complete roster of branch personnel.

| Column Index | Column Header | Data Type | Example / Format |
| :---: | :--- | :--- | :--- |
| **A** | `Staff_ID` | String | `CBE_ADM01`, `CBE_EMP01` |
| **B** | `Full_Name` | String | `Rajesh Kumar` |
| **C** | `Role` | Enum | `ADMIN`, `HR`, `EMPLOYEE`, `INTERN` |
| **D** | `Branch` | Enum | `CHN`, `CBE`, `MDU`, `ERD` |
| **E** | `Email` | String | `rajesh@gatewaysolutions.com` |
| **F** | `Mobile` | String | `9876543210` |
| **G** | `Designation` | String | `Senior Technical Trainer` |
| **H** | `Department` | String | `Training`, `Operations` |
| **I** | `Join_Date` | Date String | `YYYY-MM-DD` |
| **J** | `Status` | Enum | `ACTIVE`, `PENDING`, `DISABLED` |

---

### 2.2 Tab: `04_Staff_Attendance`
Master attendance ledger for all personnel across the calendar month.

| Column Index | Column Header | Data Type | Example / Format |
| :---: | :--- | :--- | :--- |
| **A** | `Date` | Date String | `YYYY-MM-DD` |
| **B** | `Day` | String | `Monday`, `Tuesday` |
| **C** | `Staff_ID` | String | `CBE_EMP01` |
| **D** | `Staff_Name` | String | `Priya Sharma` |
| **E** | `Role` | Enum | `EMPLOYEE` |
| **F** | `Status` | Enum | `Present`, `Absent`, `Half Day`, `On Duty`, `Leave` |
| **G** | `Login_Time` | String | `09:15 AM` |
| **H** | `Logout_Time` | String | `06:30 PM` |
| **I** | `Working_Hours` | Number | `9.25` |
| **J** | `Verified_By` | String | `System`, `CBE_ADM01` |

---

### 2.3 Tab: `06_Student_Directory`
Central branch-wide repository of enrolled trainees and interns.

| Column Index | Column Header | Data Type | Example / Format |
| :---: | :--- | :--- | :--- |
| **A** | `Student_ID` | String | `STU_2026_001` |
| **B** | `Student_Name` | String | `Karthik S` |
| **C** | `College` | String | `PSG College of Technology` |
| **D** | `Department` | String | `Computer Science & Engineering` |
| **E** | `Year` | String | `Final Year` |
| **F** | `Contact_Email` | String | `karthik@gmail.com` |
| **G** | `Mobile` | String | `9876543211` |
| **H** | `Course` | String | `Full Stack Web Development` |
| **I** | `Domain` | String | `Next.js & Python` |
| **J** | `Mentor_ID` | String | `CBE_EMP01` |
| **K** | `Admission_Date` | Date String | `YYYY-MM-DD` |
| **L** | `Fee_Status` | Enum | `Paid`, `Partial`, `Pending` |
| **M** | `Status` | Enum | `Active`, `Completed`, `Discontinued` |

---

### 2.4 Tab: `08_Candidate_Leads`
Admissions intake and applicant conversion pipeline.

| Column Index | Column Header | Data Type | Example / Format |
| :---: | :--- | :--- | :--- |
| **A** | `Lead_ID` | String | `LEAD_2026_0142` |
| **B** | `Candidate_Name` | String | `Ananya Raman` |
| **C** | `Mobile` | String | `9876543212` |
| **D** | `Email` | String | `ananya@gmail.com` |
| **E** | `College` | String | `CIT Coimbatore` |
| **F** | `Degree` | String | `B.E. ECE` |
| **G** | `Interested_Domain` | String | `Data Science & AI` |
| **H** | `Intake_Date` | Date String | `YYYY-MM-DD` |
| **I** | `Pipeline_Stage` | Enum | `New`, `Contacted`, `Interview`, `Enrolled` |
| **J** | `Assigned_HR` | String | `CBE_HR01` |

---

### 2.5 Tab: `09_System_Audit_Log`
Append-only log of spreadsheet-side changes and system events.

| Column Index | Column Header | Data Type | Example / Format |
| :---: | :--- | :--- | :--- |
| **A** | `Timestamp` | ISO String | `2026-09-30T09:00:00.000Z` |
| **B** | `Actor` | String | `CBE_ADM01` |
| **C** | `Action` | String | `STATUS_CHANGE`, `ROW_APPEND` |
| **D** | `Target_Sheet` | String | `04_Staff_Attendance` |
| **E** | `Target_Row` | Number | `42` |
| **F** | `Summary` | String | `Status updated from Absent to Present` |

---

## 3. Dedicated Per-Employee Sub-Sheets

Dynamically provisioned per staff member via `scripts/initialize-branches.js --sync`:

### 3.1 `WL_{Staff_ID}` (Daily Worklogs)
* Example: `WL_CBE_EMP01`
* Columns:
  1. `Date` (`YYYY-MM-DD`)
  2. `Day` (`Monday`)
  3. `Login_Time` (`09:15 AM`)
  4. `Logout_Time` (`06:30 PM`)
  5. `Total_Hours` (`9.25`)
  6. `Planned_Tasks` (Multi-line text)
  7. `Completed_Tasks` (Multi-line text)
  8. `Incomplete_Reason` (Mandatory justification if uncompleted)
  9. `Sync_Status` (`Synced`)

### 3.2 `STU_{Staff_ID}` (Mentor Cohort)
* Example: `STU_CBE_EMP01`
* Maintains the active students assigned directly to this mentor, along with attendance checks and project ratings.

### 3.3 `TSK_{Staff_ID}` (Assigned Tasks)
* Example: `TSK_CBE_EMP01`
* Lists deliverables allocated to this employee, priority status, deadline, and verification notes.
