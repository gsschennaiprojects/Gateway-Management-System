import fs from 'fs';
import path from 'path';

console.log('====================================================');
console.log('📊 AUDITING DOCUMENT EXPORT TOOLBARS & FUNCTIONS');
console.log('====================================================\n');

// 1. Verify export-utils.ts content
const exportUtilsPath = path.resolve(process.cwd(), 'src/lib/export-utils.ts');
const exportUtilsContent = fs.readFileSync(exportUtilsPath, 'utf8');
const hasExportToExcel = exportUtilsContent.includes('export function exportToExcel');
const hasExportToDocx = exportUtilsContent.includes('export async function exportToDocx');

console.log('1. Verifying exportToExcel function exists:', hasExportToExcel ? '✅ PASS' : '❌ FAIL');
console.log('2. Verifying exportToDocx function exists:', hasExportToDocx ? '✅ PASS' : '❌ FAIL');

// 2. Check all dashboard page files for presence of export buttons
const pages = [
  'src/app/(dashboard)/reports/page.tsx',
  'src/app/(dashboard)/students/page.tsx',
  'src/app/(dashboard)/my-students/page.tsx',
  'src/app/(dashboard)/admin/attendance/page.tsx',
  'src/app/(dashboard)/tasks/page.tsx',
  'src/app/(dashboard)/leads/page.tsx',
  'src/app/(dashboard)/worklog/page.tsx',
  'src/app/(dashboard)/admin/directory/page.tsx',
  'src/app/(dashboard)/admin/users/page.tsx',
];

console.log('\n3. Verifying export toolbar presence across all 9 dashboard pages:');
let allGood = true;

for (const p of pages) {
  const fullPath = path.resolve(process.cwd(), p);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${p}`);
    allGood = false;
    continue;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const hasPrint = content.includes('window.print()') || content.includes('Print / PDF');
  const hasExcel = content.includes('exportToExcel') || content.includes('Download Excel') || content.includes('Export Excel');
  const hasDocx = content.includes('exportToDocx') || content.includes('Download DOCX') || content.includes('Export DOCX');

  console.log(`\n📄 ${p}:`);
  console.log(`   - Print / PDF: ${hasPrint ? '✅ PASS' : '❌ MISSING'}`);
  console.log(`   - Excel:       ${hasExcel ? '✅ PASS' : '❌ MISSING'}`);
  console.log(`   - DOCX:        ${hasDocx ? '✅ PASS' : '❌ MISSING'}`);

  if (!hasPrint || !hasExcel || !hasDocx) {
    allGood = false;
  }
}

// 4. Verify Print CSS in globals.css
const globalsCssPath = path.resolve(process.cwd(), 'src/app/globals.css');
const globalsCssContent = fs.readFileSync(globalsCssPath, 'utf8');
const hasPrintCss = globalsCssContent.includes('@media print');
console.log(`\n4. Verifying Global Print & PDF Stylesheet: ${hasPrintCss ? '✅ PASS (@media print defined)' : '❌ MISSING'}`);

console.log('\n====================================================');
if (allGood && hasPrintCss) {
  console.log('🎉 ALL 9 DASHBOARD PAGES HAVE FULL PRINT/PDF, EXCEL & DOCX SUPPORT!');
} else {
  console.log('⚠️ Some pages or styles are missing export options.');
}
console.log('====================================================\n');
