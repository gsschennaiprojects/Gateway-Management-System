# GATEWAY SOFTWARE SOLUTIONS (GSS)
## Enterprise 4-Branch Employee, Task & Student Management System
### Master Technical Specification & Google Apps Script Operations Manual

---

## 1. Executive Summary & Core Objectives

The **Gateway Software Solutions (GSS) Management System** is an enterprise-grade workforce, attendance, task allocation, and student training governance platform built using **exactly 4 independent Google Spreadsheets** (1 per operational branch), integrated with **Google Apps Script (GAS)**, **Firebase Authentication**, and **Cloud Firestore**.

### Key Architectural Constraints
* **1 Google Spreadsheet = 1 Operational Branch** (Total = 4 Spreadsheets).
  1. `Gateway Chennai Branch` (`BR_CHN_01`): `1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY`
  2. `Gateway Coimbatore Branch` (`BR_CBE_02`): `1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA`
  3. `Gateway Madurai Branch` (`BR_MDU_03`): `1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8`
  4. `Gateway Erode Branch` (`BR_ERD_04`): `1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY`
* **Google Cloud Service Account**: `gss-508@management-system-509313.iam.gserviceaccount.com`
* **Google Cloud Project ID**: `management-system-509313`
* **OAuth 2.0 Client ID**: `446096297797-1kbqt8i7hffgvkq5k5fntsvlc56mjjbg.apps.googleusercontent.com`
* **Strict Sub-Sheet Rule**: Dedicated operational sheets exist as sub-sheets inside each branch's spreadsheet. Employees do **not** get individual standalone spreadsheet files.
* **3 Dedicated Operational Sheets per Person**:
  1. `Working_Progress` (`EMP_<ID>_Working_Progress`, `HR_<ID>_Working_Progress`, `ADMIN_<ID>_Working_Progress`)
  2. `Student_Details` (`EMP_<ID>_Student_Details`, `HR_<ID>_Student_Details`, `ADMIN_<ID>_Student_Details`)
  3. `Student_Progress` (`EMP_<ID>_Student_Progress`, `HR_<ID>_Student_Progress`, `ADMIN_<ID>_Student_Progress`)
* **Single-Row Multi-Employee Task Allocation**: One unified branch task sheet (`04_Task_Allocation`). Tasks assigned to multiple people (`EMP_GSS001, EMP_GSS002`) remain on **one row**. Status changes update **in-place** without row duplication. State transitions are archived in `05_Task_History`.
* **Zero Password Storage**: No plain-text passwords or hashes in Sheets or Firestore. Authentication is handled by Firebase Auth.
* **Enforced Logout Validation**: Logout is strictly blocked if incomplete tasks lack a documented explanation in `Reason_For_Not_Completed`.

---

## 2. Multi-Branch Ecosystem Architecture

```
                               ┌────────────────────────────────┐
                               │     FIREBASE AUTHENTICATION    │
                               │   (Email / Phone Credentials)  │
                               └────────────────┬───────────────┘
                                                │ UID / Auth Tokens
                                                ▼
                               ┌────────────────────────────────┐
                               │         CLOUD FIRESTORE        │
                               │  users/{uid} | tasks | students│
                               └────────────────┬───────────────┘
                                                │ REST API (OAuth2 / Key)
                                                ▼
                               ┌────────────────────────────────┐
                               │    GOOGLE APPS SCRIPT ENGINE   │
                               │ (Triggers, Validations, Logic) │
                               └───────┬────────┬───────┬───────┘
                                       │        │       │
            ┌──────────────────────────┼────────┼───────┴──────────────────────────┐
            ▼                          ▼                ▼                          ▼
┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐
│     SPREADSHEET 01    │  │     SPREADSHEET 02    │  │     SPREADSHEET 03    │  │     SPREADSHEET 04    │
│ Gateway Chennai Branch│  │  Gateway Coimbatore   │  │    Gateway Madurai    │  │     Gateway Erode     │
│     (BR_CHN_01)       │  │     (BR_CBE_02)       │  │     (BR_MDU_03)       │  │     (BR_ERD_04)       │
└───────────────────────┘  └───────────────────────┘  └───────────────────────┘  └───────────────────────┘
```

---

## 3. Sheet Hierarchy for Each Branch Spreadsheet

Every branch spreadsheet contains **10 Common Master Sheets** plus **3 dedicated sub-sheets for every approved Employee, HR, and Admin**:

```
BRANCH SPREADSHEET (e.g. Gateway Chennai Branch)
│
├── 00_Branch_Details           (Branch location, Admin, HR, contact metadata)
├── 01_Employee_Details         (Employee registry with Branch_ID, Firebase_UID)
├── 02_HR_Details               (HR registry and branch reporting line)
├── 03_Admin_Details            (Admin registry, permissions, roles)
├── 04_Task_Allocation          (Branch-wide single-row task allocation engine)
├── 05_Task_History             (Historical log of all task status transitions)
├── 06_Student_Master           (Centralized student admission and tutor registry)
├── 07_Branch_Dashboard         (Real-time KPI metrics, charts, attendance totals)
├── 08_Branch_Settings          (Working hours, shift times, timezone, holidays)
├── 09_Audit_Log                (Immutable compliance log of every system action)
│
├── EMP_GSS001_Working_Progress (Daily attendance, planned work, login/logout)
├── EMP_GSS001_Student_Details  (Active students assigned to EMP_GSS001)
├── EMP_GSS001_Student_Progress (Daily topic, practicals, test results per student)
│
├── EMP_GSS002_Working_Progress
├── EMP_GSS002_Student_Details
├── EMP_GSS002_Student_Progress
│
├── HR_GSS001_Working_Progress
├── HR_GSS001_Student_Details
├── HR_GSS001_Student_Progress
│
├── ADMIN_GSS001_Working_Progress
├── ADMIN_GSS001_Student_Details
└── ADMIN_GSS001_Student_Progress
```

---

## 4. Complete Column Specifications

### 4.1. `00_Branch_Details`
| # | Column Name | Type | Description |
|---|---|---|---|
| 1 | `Branch_ID` | String | Unique ID e.g. `BR_CHN_01` |
| 2 | `Branch_Name` | String | Full name e.g. `Gateway Chennai Branch` |
| 3 | `Branch_Code` | String | e.g. `CHN` |
| 4 | `Location` | String | City, State |
| 5 | `Address` | String | Physical office address |
| 6 | `Branch_Email` | String | Official contact email |
| 7 | `Branch_Phone` | String | Office telephone |
| 8 | `Branch_Admin_ID`| String | Assigned admin ID |
| 9 | `Branch_Admin_Name`| String | Admin display name |
| 10| `HR_ID` | String | Lead HR ID |
| 11| `HR_Name` | String | Lead HR name |
| 12| `Opening_Date` | Date | `dd-MM-yyyy` |
| 13| `Status` | Dropdown | `Active`, `Inactive`, `Temporarily Closed` |
| 14| `Created_Date` | Date | Record timestamp |
| 15| `Last_Updated` | Date | Last modification timestamp |

### 4.2. `01_Employee_Details`
| # | Column Name | Type | Key / Validation |
|---|---|---|---|
| 1 | `Employee_ID` | String | **Primary Key** e.g. `EMP_GSS001` |
| 2 | `Employee_Name` | String | Full Name |
| 3 | `Branch_ID` | String | Foreign Key to Branch |
| 4 | `Email` | String | Unique work email |
| 5 | `Mobile` | String | 10+ digits |
| 6 | `Designation` | String | e.g. Full Stack Developer |
| 7 | `Department` | String | e.g. Engineering, Training |
| 8 | `Domain` | String | e.g. Python, Java, Cloud |
| 9 | `Joining_Date` | Date | `dd-MM-yyyy` |
| 10| `Reporting_Manager` | String | Manager Name or ID |
| 11| `HR_ID` | String | Assigned HR ID |
| 12| `Admin_ID` | String | Assigned Admin ID |
| 13| `Employment_Type` | Dropdown | `Full Time`, `Part Time`, `Contract`, `Intern`, `Trainee` |
| 14| `Status` | Dropdown | `Active`, `Inactive`, `On Leave`, `Terminated` |
| 15| `Firebase_UID` | String | Connected Firebase Auth UID |
| 16| `Account_Status` | Dropdown | `Pending Approval`, `Active`, `Suspended`, `Rejected` |
| 17| `Created_Date` | Date | Registration timestamp |
| 18| `Updated_Date` | Date | Last modification timestamp |

### 4.3. `02_HR_Details`
| # | Column Name | Type | Key / Validation |
|---|---|---|---|
| 1 | `HR_ID` | String | **Primary Key** e.g. `HR_GSS001` |
| 2 | `HR_Name` | String | Full Name |
| 3 | `Branch_ID` | String | Foreign Key |
| 4 | `Email` | String | Unique email |
| 5 | `Mobile` | String | Mobile phone |
| 6 | `Designation` | String | e.g. HR Manager |
| 7 | `Joining_Date` | Date | `dd-MM-yyyy` |
| 8 | `Reporting_Manager` | String | Reporting Line |
| 9 | `Status` | Dropdown | `Active`, `Inactive`, `On Leave` |
| 10| `Firebase_UID` | String | Connected Firebase Auth UID |
| 11| `Account_Status` | Dropdown | `Pending Approval`, `Active`, `Suspended`, `Rejected` |
| 12| `Created_Date` | Date | Registration timestamp |
| 13| `Updated_Date` | Date | Last update timestamp |

### 4.4. `03_Admin_Details`
| # | Column Name | Type | Key / Validation |
|---|---|---|---|
| 1 | `Admin_ID` | String | **Primary Key** e.g. `ADMIN_GSS001` |
| 2 | `Admin_Name` | String | Full Name |
| 3 | `Branch_ID` | String | Foreign Key |
| 4 | `Email` | String | Unique email |
| 5 | `Mobile` | String | Phone |
| 6 | `Designation` | String | e.g. Branch Director |
| 7 | `Joining_Date` | Date | `dd-MM-yyyy` |
| 8 | `Permissions` | String | Permissions bitmask/list |
| 9 | `Status` | Dropdown | `Active`, `Inactive`, `Suspended` |
| 10| `Firebase_UID` | String | Connected Firebase Auth UID |
| 11| `Account_Status` | Dropdown | `Pending Approval`, `Active`, `Suspended`, `Rejected` |
| 12| `Created_Date` | Date | Registration timestamp |
| 13| `Updated_Date` | Date | Last update timestamp |

### 4.5. `04_Task_Allocation`
| # | Column Name | Type | Rules |
|---|---|---|---|
| 1 | `Task_ID` | String | **Primary Key** e.g. `TASK_001` |
| 2 | `Day` | String | Auto-derived from Date (e.g. `Monday`) |
| 3 | `Date` | Date | Creation date `dd-MM-yyyy` |
| 4 | `Assigned_By_ID` | String | Assigner ID |
| 5 | `Assigned_By_Name` | String | Assigner Name |
| 6 | `Assigned_To_ID` | String | Primary assignee ID |
| 7 | `Assigned_To_Name` | String | Primary assignee Name |
| 8 | `Assigned_To_Multiple` | String | Comma-separated IDs: `EMP_GSS001, EMP_GSS002` |
| 9 | `Task_Title` | String | Brief title |
| 10| `Task_Description` | String | Scope & requirements |
| 11| `Priority` | Dropdown | `Low`, `Medium`, `High`, `Urgent` |
| 12| `Category` | String | e.g. `Training`, `Development`, `Client Project` |
| 13| `Start_Date` | Date | Auto-populated when status -> `On Progress` |
| 14| `Expected_Completion_Date` | Date | Deadline |
| 15| `Completed_Date` | Date | Auto-populated when status -> `Completed` |
| 16| `Status` | Dropdown | `Assigned`, `On Progress`, `Completed`, `Partially Stopped` |
| 17| `Progress_Percentage` | Number | `0` to `100` |
| 18| `Remarks` | String | Progress notes |
| 19| `Created_Date` | Date | Creation timestamp |
| 20| `Last_Updated` | Date | Last edit timestamp |

### 4.6. `05_Task_History`
| # | Column Name | Type | Description |
|---|---|---|---|
| 1 | `History_ID` | String | **Primary Key** e.g. `HIST_001` |
| 2 | `Task_ID` | String | Foreign key to `04_Task_Allocation` |
| 3 | `Timestamp` | DateTime | `dd-MM-yyyy hh:mm:ss a` |
| 4 | `Changed_By_ID` | String | User ID who updated status |
| 5 | `Changed_By_Name` | String | User name |
| 6 | `Old_Status` | String | Previous status |
| 7 | `New_Status` | String | Updated status |
| 8 | `Progress_Percentage` | Number | Progress level at transition |
| 9 | `Remarks` | String | Transition rationale |

### 4.7. Dedicated Personal `Working_Progress` Sheets
*Applies to `EMP_<ID>_Working_Progress`, `HR_<ID>_Working_Progress`, `ADMIN_<ID>_Working_Progress`*
| # | Column Name | Auto/Manual | Description |
|---|---|---|---|
| 1 | `Day` | Auto | Derived from Date (e.g. `Monday`) |
| 2 | `Date` | Auto | `dd-MM-yyyy` generated by morning trigger |
| 3 | `Employee_ID` | Auto | e.g. `EMP_GSS001` (or `HR_ID` / `Admin_ID`) |
| 4 | `Employee_Name` | Auto | Display name |
| 5 | `Login_Time` | Auto (System) | Official timestamp captured on Punch In |
| 6 | `Planned_Task` | Auto | Binds from `04_Task_Allocation` |
| 7 | `Task_ID` | Auto | Matching Task IDs |
| 8 | `Completed_Task` | Dropdown | `Yes`, `No`, `Partially` |
| 9 | `Pending_Task` | Text | Title of tasks remaining |
| 10| `Logout_Time` | Auto (System) | Timestamp captured on Punch Out |
| 11| `Reason_For_Not_Completed`| Mandatory if incomplete | Required to allow logout |
| 12| `Status` | Dropdown | `Assigned`, `On Progress`, `Completed`, `Partially Stopped` |
| 13| `Working_Hours` | Auto (Calculated) | `Logout_Time - Login_Time` formatted as `8h 45m` |
| 14| `Remarks` | Manual | Daily review notes |

### 4.8. Dedicated Personal `Student_Details` Sheets
*Applies to `EMP_<ID>_Student_Details`, `HR_<ID>_Student_Details`, `ADMIN_<ID>_Student_Details`*
| # | Column Name | Type | Description |
|---|---|---|---|
| 1 | `Student_ID` | String | Master Student ID |
| 2 | `Student_Name` | String | Full Name |
| 3 | `Branch_ID` | String | Branch code |
| 4 | `College` | String | Enrolled institution |
| 5 | `Department` | String | e.g. Computer Science |
| 6 | `Year` | String | Academic Year |
| 7 | `Email` | String | Contact email |
| 8 | `Mobile` | String | Mobile number |
| 9 | `Domain` | String | e.g. Data Science |
| 10| `Course` | String | Course track |
| 11| `Training_Type` | String | Internship / Training |
| 12| `Tutor_ID` | String | This person's ID |
| 13| `Tutor_Name` | String | This person's Name |
| 14| `Assigned_Date` | Date | `dd-MM-yyyy` |
| 15| `Start_Date` | Date | Course start |
| 16| `Expected_End_Date` | Date | Target completion |
| 17| `Actual_End_Date` | Date | Actual completion |
| 18| `Fee_Status` | Dropdown | `Paid`, `Partial`, `Pending` |
| 19| `Project_Status` | Dropdown | `Not Started`, `Ongoing`, `Under Review`, `Completed` |
| 20| `Student_Status` | Dropdown | `Active`, `Completed`, `Discontinued` |
| 21| `Remarks` | Text | Notes |
| 22| `Created_Date` | Date | Registration date |
| 23| `Updated_Date` | Date | Last modification |

### 4.9. Dedicated Personal `Student_Progress` Sheets
*Applies to `EMP_<ID>_Student_Progress`, `HR_<ID>_Student_Progress`, `ADMIN_<ID>_Student_Progress`*
| # | Column Name | Type | Description |
|---|---|---|---|
| 1 | `Progress_ID` | String | Unique entry ID e.g. `PROG_001` |
| 2 | `Student_ID` | String | Student identifier |
| 3 | `Student_Name` | String | Student display name |
| 4 | `Day` | Auto | Derived from Date |
| 5 | `Date` | Auto | `dd-MM-yyyy` |
| 6 | `Topic` | Text | Modules covered today |
| 7 | `Task` | Text | Practical task assigned |
| 8 | `Task_Status` | Dropdown | `Assigned`, `On Progress`, `Completed`, `Partially Stopped` |
| 9 | `Progress_Percentage` | Number | 0 to 100 |
| 10| `Practical_Completed` | Dropdown | `Yes`, `No`, `Under Review` |
| 11| `Assignment_Status` | Dropdown | `Submitted`, `Pending`, `Evaluated` |
| 12| `Test_Status` | Dropdown | `Passed`, `Failed`, `Pending` |
| 13| `Remarks` | Text | Mentor feedback |
| 14| `Next_Task` | Text | Tomorrow's task |
| 15| `Updated_Date` | Date | Timestamp |

### 4.10. `06_Student_Master`
Centralized registry for all students across the branch:
`Student_ID`, `Student_Name`, `Branch_ID`, `College`, `Department`, `Year`, `Email`, `Mobile`, `Domain`, `Course`, `Assigned_To_ID`, `Assigned_To_Name`, `Assigned_Role`, `Start_Date`, `Expected_End_Date`, `Fee_Status`, `Project_Status`, `Student_Status`, `Created_Date`, `Updated_Date`.

### 4.11. `07_Branch_Dashboard`
Executive KPI control center with real-time operational calculations:
- Active counts: Total Employees, Total HR, Total Admin, Active Users.
- Today's Attendance: Logged In, Logged Out, Absent.
- Task Performance: Total Tasks, Assigned, On Progress, Completed, Partially Stopped, Overdue Tasks (`Expected_Completion_Date < Today && Status != Completed`).
- Student Performance: Total Students, Active Students, Average Completion Rate.
- Detailed Employee Task & Attendance Matrix.

### 4.12. `08_Branch_Settings`
Configurable operational policies:
`Branch_ID`, `Working_Start_Time` (09:00 AM), `Working_End_Time` (06:00 PM), `Lunch_Start` (01:00 PM), `Lunch_End` (02:00 PM), `Working_Days` (Monday to Saturday), `Sunday_Working` (FALSE), `Holiday_List`, `Default_Task_Status` (Assigned), `Minimum_Required_Reason` (10 chars), `Time_Zone` (`Asia/Kolkata`), `Date_Format` (`dd-MM-yyyy`), `Currency` (`INR`).

### 4.13. `09_Audit_Log`
Immutable system audit log:
`Timestamp`, `User_ID`, `User_Name`, `Role`, `Action` (Create, Update, Approve, Reject, Task Status Change, Login, Logout, Student Update), `Module`, `Record_ID`, `Branch_ID`, `Old_Value`, `New_Value`.

---

## 5. Core Workflows & Logic

### 5.1. Strict Logout Validation Logic
```
                          [User Requests Punch Out]
                                     │
                                     ▼
                    [Check Today's Working Record]
                                     │
                                     ▼
                     Are all planned tasks completed?
                    (Completed_Task = 'Yes' OR Status = 'Completed')
                                  /     \
                               YES       NO
                               /           \
                              /             ▼
                             /     Is Reason_For_Not_Completed
                            /      provided (length >= 10 chars)?
                           /             /     \
                          /            YES      NO
                         /             /          \
                        ▼             ▼            ▼
                 [ALLOW LOGOUT]  [ALLOW LOGOUT]  [BLOCK LOGOUT]
                        │               │        Display Alert:
                        └───────┬───────┘        "Logout blocked. Provide
                                │                a valid reason for every
                                ▼                incomplete task."
                      Capture Logout_Time
                      Calculate Working_Hours
                      (Logout_Time - Login_Time)
```

### 5.2. Single-Row Task Allocation & Status Transition
```
[Admin Creates Task]
       │
       ▼
Insert row into 04_Task_Allocation
Assigned_To_Multiple: "EMP_GSS001, EMP_GSS002, EMP_GSS004"
Status: "Assigned" | Start_Date: "" | Completed_Date: ""
       │
       ▼
Propagate task to EMP_GSS001, EMP_GSS002, EMP_GSS004 Working_Progress sheets
       │
       ▼
[Employee starts task: Change Status to 'On Progress']
       │
       ├─ In-place row update on 04_Task_Allocation
       ├─ Auto-fill Start_Date = Today
       └─ Append transition record to 05_Task_History
       │
       ▼
[Employee finishes task: Change Status to 'Completed']
       │
       ├─ In-place row update on 04_Task_Allocation
       ├─ Auto-fill Completed_Date = Today
       ├─ Set Progress_Percentage = 100
       └─ Append transition record to 05_Task_History
```

### 5.3. Account Approval & Automatic Sheet Generation
```
[New Employee Enrolled in 01_Employee_Details]
Status: "Inactive" | Account_Status: "Pending Approval"
                         │
                         ▼
             [Admin / Authorized HR Reviews]
                         │
                         ▼
                 [Action: Approve]
                         │
                         ├─ 1. Update Status = "Active", Account_Status = "Active"
                         │
                         ├─ 2. Automatically create 3 dedicated sub-sheets:
                         │     • EMP_<ID>_Working_Progress
                         │     • EMP_<ID>_Student_Details
                         │     • EMP_<ID>_Student_Progress
                         │
                         ├─ 3. Format header styling, dropdown validations, frozen row 1
                         │
                         ├─ 4. Append audit record to 09_Audit_Log
                         │
                         └─ 5. Sync profile to Firestore collection 'users/{uid}'
```

---

## 6. Firebase Authentication & Firestore Schema

### 6.1. Firebase Authentication
- Authentication credentials (Email/Password, Phone OTP) are managed strictly within Firebase Auth.
- No user passwords or password hashes are ever written into Google Sheets or Firestore.

### 6.2. Firestore Collection: `users/{uid}`
```json
{
  "uid": "fb_emp_gss001",
  "employeeId": "EMP_GSS001",
  "name": "Karthik Raja",
  "email": "karthik.raja@gatewaysolutions.com",
  "mobile": "+91 98401 23456",
  "role": "EMPLOYEE",
  "branchId": "BR_CHN_01",
  "designation": "Senior Full Stack Engineer",
  "department": "Engineering",
  "status": "Active",
  "accountStatus": "Active",
  "permissions": ["READ", "WRITE_OWN_TASKS", "UPDATE_OWN_STUDENTS"],
  "createdAt": "2026-09-01T09:00:00.000Z",
  "updatedAt": "2026-09-21T18:00:00.000Z",
  "lastLogin": "2026-09-21T09:05:00.000Z"
}
```

### 6.3. Firestore Collection: `tasks/{taskId}`
```json
{
  "taskId": "TASK_001",
  "branchId": "BR_CHN_01",
  "assignedById": "ADMIN_GSS001",
  "assignedByName": "Branch Administrator",
  "assignedToId": "EMP_GSS001",
  "assignedToName": "Karthik Raja",
  "assignedToMultiple": ["EMP_GSS001", "EMP_GSS002"],
  "taskTitle": "Student REST API Backend Development",
  "taskDescription": "Implement secure authentication and daily progress endpoints using Fastify and Prisma.",
  "priority": "High",
  "category": "Development",
  "startDate": "21-09-2026",
  "expectedCompletionDate": "25-09-2026",
  "completedDate": "",
  "status": "On Progress",
  "progressPercentage": 60,
  "remarks": "Database migrations completed; endpoints in progress.",
  "createdAt": "2026-09-21T09:00:00.000Z",
  "updatedAt": "2026-09-21T14:30:00.000Z"
}
```

### 6.4. Firestore Collection: `students/{studentId}`
```json
{
  "studentId": "STU_GSS001",
  "studentName": "Arun Kumar",
  "branchId": "BR_CHN_01",
  "college": "Anna University",
  "department": "Computer Science and Engineering",
  "year": "Final Year",
  "email": "arun.kumar@gmail.com",
  "mobile": "+91 97890 12345",
  "domain": "Python / AI",
  "course": "Full Stack AI Certification",
  "assignedToId": "EMP_GSS001",
  "assignedToName": "Karthik Raja",
  "startDate": "01-08-2026",
  "expectedEndDate": "31-10-2026",
  "feeStatus": "Paid",
  "projectStatus": "Ongoing",
  "studentStatus": "Active",
  "createdAt": "2026-08-01T10:00:00.000Z",
  "updatedAt": "2026-09-21T16:00:00.000Z"
}
```

---

## 7. Modular Google Apps Script Files in Repository

The production Google Apps Script modules have been cleanly structured inside:
[`google-apps-script/`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/)

| Module Name | Path | Primary Responsibility |
|---|---|---|
| `Config.gs` | [`Config.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Config.gs) | 4-Branch IDs, sheet names, status enums, theme hex colors, and Firestore endpoints. |
| `Utils.gs` | [`Utils.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Utils.gs) | IST Time, date formatting, duration math (`8h 45m`), header styling, column auto-resizing. |
| `Audit.gs` | [`Audit.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Audit.gs) | Immutable logging to `09_Audit_Log` and async push to Firestore `audit_logs`. |
| `Validation.gs` | [`Validation.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Validation.gs) | Logout blocker, unique ID checks, chronological date sequence verification. |
| `Firebase.gs` | [`Firebase.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Firebase.gs) | REST client to Cloud Firestore with automatic object encoder and offline fallback. |
| `Employee.gs` | [`Employee.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Employee.gs) | `01_Employee_Details` management & automatic generation of the 3 dedicated employee sub-sheets. |
| `HR.gs` | [`HR.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/HR.gs) | `02_HR_Details` management & automatic generation of the 3 dedicated HR sub-sheets. |
| `Admin.gs` | [`Admin.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Admin.gs) | `03_Admin_Details` management & automatic generation of the 3 dedicated Admin sub-sheets. |
| `Intern.gs` | [`Intern.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Intern.gs) | `04_Intern_Details` management & dedicated intern operational tracking sheets. |
| `Task.gs` | [`Task.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Task.gs) | Single-row multi-assignment task engine, in-place status updater, and history logging. |
| `Attendance.gs` | [`Attendance.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Attendance.gs) | Morning trigger auto-row generation, tamper-proof login punch, and validated logout punch. |
| `Student.gs` | [`Student.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Student.gs) | `06_Student_Master` central registry & personal Student Details / Progress linking. |
| `Dashboard.gs` | [`Dashboard.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Dashboard.gs) | KPI aggregation engine, card layout styling, and employee performance table formatter. |
| `Code.gs` | [`Code.gs`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/Code.gs) | Spreadsheet UI menu (`🚀 GSS Enterprise Menu`), interactive modals, and time triggers. |

---

## 8. Realistic Example Dataset

## 8. Operational Branch Registry & Links

| Branch Code | Branch Name | Spreadsheet ID | Direct Link |
|---|---|---|---|
| `BR_CHN_01` | Gateway Chennai Branch | `1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY` | [Open Chennai Sheet](https://docs.google.com/spreadsheets/d/1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY/edit) |
| `BR_CBE_02` | Gateway Coimbatore Branch | `1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA` | [Open Coimbatore Sheet](https://docs.google.com/spreadsheets/d/1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA/edit) |
| `BR_MDU_03` | Gateway Madurai Branch | `1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8` | [Open Madurai Sheet](https://docs.google.com/spreadsheets/d/1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8/edit) |
| `BR_ERD_04` | Gateway Erode Branch | `1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY` | [Open Erode Sheet](https://docs.google.com/spreadsheets/d/1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY/edit) |

> [!IMPORTANT]
> **Service Account Access Requirement**:
> The Google Service Account `gss-508@management-system-509313.iam.gserviceaccount.com` **must be granted Editor permissions** on all 4 spreadsheets above so that automated API operations and synchronizations can execute without authorization errors.

---

## 9. Deployment & Setup Guide

1. **Share Spreadsheets with Service Account**:
   - In each of the 4 Google Spreadsheets above, click the blue **Share** button in the top right.
   - Paste: `gss-508@management-system-509313.iam.gserviceaccount.com`
   - Select role: **Editor**, uncheck "Notify people", and click **Share**.
2. **Open Apps Script Editor** in each spreadsheet (`Extensions` -> `Apps Script`).
3. **Copy the 14 `.gs` files** from [`google-apps-script/`](file:///c:/Users/jasva/Desktop/project/GMS/google-apps-script/) into the project.
4. **Reload the Spreadsheet**:
   - A custom menu item `🚀 GSS Enterprise Menu` will appear in the Google Sheets toolbar.
5. **Initialize the Branch**:
   - Click `🚀 GSS Enterprise Menu` -> `🏢 Initialize Common Branch Sheets`.
   - The script will automatically detect the spreadsheet ID, recognize the branch (Chennai, Coimbatore, Madurai, or Erode), and initialize all 10 common sheets with formatted enterprise styling.
6. **Activate Automated Triggers**:
   - Click `🚀 GSS Enterprise Menu` -> `⚙️ Setup Automated Daily Triggers`.
   - This schedules the automated 6:00 AM daily morning row generation and hourly health monitor.
