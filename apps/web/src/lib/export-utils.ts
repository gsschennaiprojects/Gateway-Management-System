'use client';

import * as XLSX from 'xlsx';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
  convertInchesToTwip,
} from 'docx';

export interface ExcelColumn {
  header: string;
  key?: string;
  width?: number;
}

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  title?: string;
  subtitle?: string;
  metadata?: Record<string, string>;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  columnWidths?: number[];
}

/**
 * Downloads a professionally formatted Excel spreadsheet (.xlsx)
 * with title banner, metadata block, and auto-spaced columns.
 */
export function exportToExcel(options: ExcelExportOptions): void {
  const {
    filename,
    sheetName = 'Sheet1',
    title,
    subtitle,
    metadata,
    headers,
    rows,
    columnWidths,
  } = options;

  const aoa: any[][] = [];

  // 1. Optional Title & Subtitle
  if (title) {
    aoa.push([`Gateway Software Solutions — ${title}`]);
    if (subtitle) {
      aoa.push([subtitle]);
    }
    aoa.push([]); // Spacer
  }

  // 2. Metadata Block (e.g. Employee, Branch, Period, Export Time)
  if (metadata && Object.keys(metadata).length > 0) {
    Object.entries(metadata).forEach(([k, v]) => {
      aoa.push([`${k}:`, v]);
    });
    aoa.push([`Generated On:`, new Date().toLocaleString()]);
    aoa.push([]); // Spacer
  }

  // 3. Table Headers
  aoa.push(headers);

  // 4. Table Rows
  rows.forEach((row) => {
    aoa.push(row.map((val) => (val === null || val === undefined ? '' : val)));
  });

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Auto-calculate column widths
  const maxCols = headers.length;
  const colWidthArr: { wch: number }[] = [];

  for (let c = 0; c < maxCols; c++) {
    let maxLen = headers[c] ? headers[c].toString().length : 10;
    // Inspect up to first 100 rows for sizing
    const sampleLimit = Math.min(rows.length, 100);
    for (let r = 0; r < sampleLimit; r++) {
      const cellVal = rows[r]?.[c];
      if (cellVal !== undefined && cellVal !== null) {
        const len = cellVal.toString().length;
        if (len > maxLen) maxLen = len;
      }
    }
    const finalWidth = columnWidths?.[c] || Math.min(Math.max(maxLen + 4, 12), 45);
    colWidthArr.push({ wch: finalWidth });
  }

  ws['!cols'] = colWidthArr;

  // Create workbook and trigger download
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));

  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
}

export interface DocxSectionTable {
  headers: string[];
  rows: (string | number)[][];
  columnWidthsPercentage?: number[]; // e.g. [25, 45, 15, 15]
}

export interface DocxSection {
  heading: string;
  description?: string;
  bullets?: string[];
  paragraphs?: string[];
  table?: DocxSectionTable;
}

export interface DocxExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  staffName?: string;
  staffRole?: string;
  branch?: string;
  period?: string;
  systemChecksum?: string;
  sections: DocxSection[];
}

/**
 * Downloads a beautifully aligned and styled Microsoft Word document (.docx)
 * with corporate branding, styled tables, headings, and digital audit signatures.
 */
export async function exportToDocx(options: DocxExportOptions): Promise<void> {
  const {
    filename,
    title,
    subtitle,
    staffName,
    staffRole,
    branch,
    period,
    systemChecksum = `GSS-DOCX-${Date.now().toString(36).toUpperCase()}`,
    sections,
  } = options;

  const docChildren: any[] = [];

  // Top Super Header
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: 'GATEWAY SOFTWARE SOLUTIONS • GSS MANAGEMENT SYSTEM',
          size: 18, // 9pt
          color: '1A73E8',
          bold: true,
          font: 'Segoe UI',
        }),
      ],
    })
  );

  // Document Title
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: title,
          size: 36, // 18pt
          bold: true,
          color: '1F1F1F',
          font: 'Segoe UI',
        }),
      ],
    })
  );

  // Subtitle / Period
  if (subtitle || period) {
    docChildren.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: subtitle || `Audit Period: ${period}`,
            size: 22, // 11pt
            color: '5F6368',
            font: 'Segoe UI',
          }),
        ],
      })
    );
  }

  // Metadata Card / Executive Summary Table
  if (staffName || branch) {
    const metaTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'DADCE0' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DADCE0' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'DADCE0' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'DADCE0' },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: 'F8FAFD' },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'STAFF MEMBER', size: 16, color: '747775', bold: true, font: 'Segoe UI' }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: staffName || 'N/A', size: 24, bold: true, color: '1F1F1F', font: 'Segoe UI' }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `${staffRole || 'Employee'} • ${branch || 'Coimbatore'} Branch`, size: 18, color: '1A73E8', font: 'Segoe UI' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: 'F8FAFD' },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: 'DOCUMENT STATUS', size: 16, color: '747775', bold: true, font: 'Segoe UI' }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: 'Verified Record', size: 22, bold: true, color: '137333', font: 'Segoe UI' }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, size: 18, color: '5F6368', font: 'Segoe UI' }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    docChildren.push(metaTable);
    docChildren.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
  }

  // Iterate over sections
  sections.forEach((sec) => {
    // Section Heading
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: sec.heading,
            size: 26, // 13pt
            bold: true,
            color: '1A73E8',
            font: 'Segoe UI',
          }),
        ],
      })
    );

    // Optional description
    if (sec.description) {
      docChildren.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: sec.description,
              size: 20,
              color: '444746',
              font: 'Segoe UI',
            }),
          ],
        })
      );
    }

    // Optional paragraphs
    if (sec.paragraphs) {
      sec.paragraphs.forEach((p) => {
        docChildren.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: p,
                size: 20,
                color: '1F1F1F',
                font: 'Segoe UI',
              }),
            ],
          })
        );
      });
    }

    // Optional bullets
    if (sec.bullets) {
      sec.bullets.forEach((b) => {
        docChildren.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: b,
                size: 20,
                color: '1F1F1F',
                font: 'Segoe UI',
              }),
            ],
          })
        );
      });
    }

    // Optional Table
    if (sec.table && sec.table.headers.length > 0) {
      const tableRows: TableRow[] = [];

      // Header Row
      const headerCells = sec.table.headers.map((h, idx) => {
        const widthPct = sec.table?.columnWidthsPercentage?.[idx] || (100 / sec.table!.headers.length);
        return new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: '1A73E8' },
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
          children: [
            new Paragraph({
              alignment: idx > 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: h,
                  bold: true,
                  color: 'FFFFFF',
                  size: 19,
                  font: 'Segoe UI',
                }),
              ],
            }),
          ],
        });
      });
      tableRows.push(new TableRow({ children: headerCells }));

      // Body Rows
      sec.table.rows.forEach((row, rowIdx) => {
        const isEven = rowIdx % 2 === 0;
        const bodyCells = row.map((cellVal, colIdx) => {
          const widthPct = sec.table?.columnWidthsPercentage?.[colIdx] || (100 / sec.table!.headers.length);
          return new TableCell({
            width: { size: widthPct, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: isEven ? 'FFFFFF' : 'F8FAFD' },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: colIdx > 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [
                  new TextRun({
                    text: cellVal !== null && cellVal !== undefined ? cellVal.toString() : '',
                    size: 19,
                    color: '1F1F1F',
                    font: 'Segoe UI',
                  }),
                ],
              }),
            ],
          });
        });
        tableRows.push(new TableRow({ children: bodyCells }));
      });

      const sectionTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: 'DADCE0' },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: 'DADCE0' },
          left: { style: BorderStyle.SINGLE, size: 2, color: 'DADCE0' },
          right: { style: BorderStyle.SINGLE, size: 2, color: 'DADCE0' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E8EAED' },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: tableRows,
      });

      docChildren.push(sectionTable);
      docChildren.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    }
  });

  // Footer / Digital Verification Section
  docChildren.push(new Paragraph({ spacing: { before: 240, after: 120 }, children: [] }));
  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 3, color: 'DADCE0' },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            margins: { top: 160, bottom: 80, left: 0, right: 0 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `System Checksum: ${systemChecksum}`, size: 16, bold: true, color: '444746', font: 'Consolas' }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Digitally verified via Gateway Software Solutions Management System Core', size: 16, color: '747775', font: 'Segoe UI' }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            margins: { top: 160, bottom: 80, left: 0, right: 0 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: '___________________________', size: 18, color: 'DADCE0' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Operations & Branch Director', size: 18, bold: true, color: '1F1F1F', font: 'Segoe UI' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: 'Gateway Software Solutions', size: 16, color: '747775', font: 'Segoe UI' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  docChildren.push(footerTable);

  // Build Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  // Pack into Blob and download
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
