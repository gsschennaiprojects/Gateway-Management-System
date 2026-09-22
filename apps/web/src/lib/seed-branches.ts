/**
 * ============================================================================
 * GSS — BRANCH METADATA SEEDER
 * Seeds the 4 branch documents into Firestore `branches` collection.
 * 
 * Usage: Called from the API route POST /api/admin/seed-branches
 *        or via client-side admin panel button.
 * ============================================================================
 */

import type { GSSBranch } from './firestore';

/**
 * Canonical branch definitions for Gateway Software Solutions.
 * Each branch maps to a unique Google Sheets spreadsheet for operational data.
 */
export const BRANCH_SEED_DATA: GSSBranch[] = [
  {
    branchId: 'BR_CHN_01',
    branchName: 'Gateway Chennai Branch',
    branchCode: 'CHN',
    location: 'Chennai, Tamil Nadu',
    address: 'GSS Technology Campus, Chennai, Tamil Nadu',
    contactEmail: 'chn@gatewaysolutions.com',
    contactPhone: '+91 98765 43210',
    workStartTime: '09:00 AM',
    workEndTime: '06:00 PM',
    status: 'Active',
    spreadsheetId: '1dfKmBvtc15H8JC-tybDMiBOfD0nVScDG1kR6Hpd-bxY',
  },
  {
    branchId: 'BR_CBE_02',
    branchName: 'Gateway Coimbatore Branch',
    branchCode: 'CBE',
    location: 'Coimbatore, Tamil Nadu',
    address: 'GSS Technology Campus, Coimbatore, Tamil Nadu',
    contactEmail: 'cbe@gatewaysolutions.com',
    contactPhone: '+91 98765 43211',
    workStartTime: '09:00 AM',
    workEndTime: '06:00 PM',
    status: 'Active',
    spreadsheetId: '1pu0IxgbFYwSVXycWXVepXp76476SH1j7a-VxfY_cOnA',
  },
  {
    branchId: 'BR_MDU_03',
    branchName: 'Gateway Madurai Branch',
    branchCode: 'MDU',
    location: 'Madurai, Tamil Nadu',
    address: 'GSS Technology Campus, Madurai, Tamil Nadu',
    contactEmail: 'mdu@gatewaysolutions.com',
    contactPhone: '+91 98765 43212',
    workStartTime: '09:00 AM',
    workEndTime: '06:00 PM',
    status: 'Active',
    spreadsheetId: '1j8JjIXk-9MyvkDTImXr5nZqsihRH5dvIDNluukS0LZ8',
  },
  {
    branchId: 'BR_ERD_04',
    branchName: 'Gateway Erode Branch',
    branchCode: 'ERD',
    location: 'Erode, Tamil Nadu',
    address: 'GSS Technology Campus, Erode, Tamil Nadu',
    contactEmail: 'erd@gatewaysolutions.com',
    contactPhone: '+91 98765 43213',
    workStartTime: '09:00 AM',
    workEndTime: '06:00 PM',
    status: 'Active',
    spreadsheetId: '1PqPiWkXdelII7IaS5Ua-LJ1vsswYEQVG9YHynMoPegY',
  },
];

/**
 * Map branch code to spreadsheet ID for quick lookups.
 */
export const BRANCH_SPREADSHEET_MAP: Record<string, string> = Object.fromEntries(
  BRANCH_SEED_DATA.map(b => [b.branchCode, b.spreadsheetId])
);

/**
 * Map branch code to branch ID.
 */
export const BRANCH_CODE_TO_ID: Record<string, string> = Object.fromEntries(
  BRANCH_SEED_DATA.map(b => [b.branchCode, b.branchId])
);

/**
 * Map branch name (as used in auth.ts) to branch code.
 */
export const BRANCH_NAME_TO_CODE: Record<string, string> = {
  'Chennai': 'CHN',
  'Coimbatore': 'CBE',
  'Madurai': 'MDU',
  'Erode': 'ERD',
};
