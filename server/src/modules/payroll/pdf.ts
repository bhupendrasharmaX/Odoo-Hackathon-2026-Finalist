import PDFDocument from 'pdfkit';
import { env } from '../../config/env';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Payslip PDF.
 *
 * Deliberately plain: a header with company and employee details, the rule
 * lines grouped by category in sequence order, and a gross / deductions / net
 * summary. Money is right-aligned in a fixed column so the figures line up,
 * which is the one thing that makes a payroll document look correct.
 */

const PAGE_MARGIN = 50;
const COLUMN = {
  label: PAGE_MARGIN,
  code: 300,
  amount: 545, // right edge for right-aligned money
};

const INK = '#16202A';
const SLATE = '#5B6B7B';
const LINE = '#E1E7EC';
const DANGER = '#B23A48';

function formatMoney(value: number): string {
  const negative = value < 0;
  const formatted = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return negative ? `-${formatted}` : formatted;
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

/** Renders one payslip and resolves with the complete PDF as a Buffer. */
export function renderPayslipPdf(payslip: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const employee = payslip.employee ?? {};
      const lines: any[] = payslip.lines ?? [];

      // ---- header ---------------------------------------------------
      doc.fillColor(INK).fontSize(20).font('Helvetica-Bold').text(env.COMPANY_NAME, PAGE_MARGIN, PAGE_MARGIN);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(SLATE)
        .text('Payslip', PAGE_MARGIN, doc.y + 2);

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(INK)
        .text(
          `${formatDate(payslip.periodStart)}  to  ${formatDate(payslip.periodEnd)}`,
          PAGE_MARGIN,
          doc.y + 6,
        );

      doc.moveDown(0.8);
      horizontalRule(doc);

      // ---- identification block -------------------------------------
      doc.moveDown(0.8);
      const detailTop = doc.y;

      const leftDetails: Array<[string, string]> = [
        ['Employee', employee.name ?? '-'],
        ['Employee code', employee.employeeCode ?? '-'],
        ['Department', employee.department?.name ?? '-'],
        ['Job position', employee.jobPosition ?? '-'],
      ];

      const rightDetails: Array<[string, string]> = [
        ['Payrun', payslip.payrun?.name ?? '-'],
        ['Structure', payslip.payrun?.salaryStructure?.name ?? '-'],
        ['Worked days', String(Number(payslip.workedDays ?? 0))],
        ['Status', payslip.status ?? '-'],
      ];

      drawDetailColumn(doc, leftDetails, PAGE_MARGIN, detailTop);
      drawDetailColumn(doc, rightDetails, 310, detailTop);

      doc.y = detailTop + leftDetails.length * 16 + 10;

      // A payslip whose contract changed mid-period must say so on the
      // document itself, not only in the UI.
      const warnings: any[] = Array.isArray(payslip.warnings) ? payslip.warnings : [];
      const proRated = warnings.find((w) => w.code === 'CONTRACT_CHANGED_MID_PERIOD');
      if (proRated) {
        doc
          .fontSize(9)
          .fillColor(DANGER)
          .font('Helvetica-Oblique')
          .text(
            'Note: more than one contract applied to this period. Amounts are pro-rated by the days each contract covered.',
            PAGE_MARGIN,
            doc.y,
            { width: 495 },
          );
        doc.moveDown(0.5);
      }

      horizontalRule(doc);
      doc.moveDown(0.6);

      // ---- salary computation table ---------------------------------
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(SLATE)
        .text('SALARY RULE', COLUMN.label, doc.y, { continued: false });

      const headerY = doc.y - 11;
      doc.text('CODE', COLUMN.code, headerY);
      doc.text('AMOUNT', 400, headerY, { width: COLUMN.amount - 400, align: 'right' });

      doc.moveDown(0.4);
      horizontalRule(doc);
      doc.moveDown(0.4);

      const ordered = [...lines].sort((a, b) => a.sequence - b.sequence);

      for (const line of ordered) {
        const amount = Number(line.amount);
        const isDeduction = line.category === 'DEDUCTION';
        const isTotal = line.category === 'GROSS' || line.category === 'NET';

        const y = doc.y;

        doc
          .fontSize(10)
          .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(INK)
          .text(line.ruleName, COLUMN.label, y, { width: 240 });

        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(SLATE)
          .text(`${line.ruleCode} · ${line.category}`, COLUMN.code, y, { width: 90 });

        doc
          .fontSize(10)
          .font(isTotal ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(isDeduction ? DANGER : INK)
          .text(formatMoney(amount), 400, y, { width: COLUMN.amount - 400, align: 'right' });

        doc.y = y + 18;

        if (isTotal) {
          horizontalRule(doc);
          doc.moveDown(0.3);
        }
      }

      // ---- summary --------------------------------------------------
      doc.moveDown(0.6);
      horizontalRule(doc);
      doc.moveDown(0.6);

      summaryRow(doc, 'Gross', Number(payslip.gross), false);
      summaryRow(doc, 'Total deductions', -Math.abs(Number(payslip.totalDeductions)), true);

      doc.moveDown(0.2);
      horizontalRule(doc);
      doc.moveDown(0.4);

      const netY = doc.y;
      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor(INK)
        .text('NET PAY', COLUMN.label, netY);
      doc.text(formatMoney(Number(payslip.net)), 380, netY, {
        width: COLUMN.amount - 380,
        align: 'right',
      });

      // ---- warnings -------------------------------------------------
      if (warnings.length > 0) {
        doc.moveDown(1.2);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(SLATE).text('NOTES', PAGE_MARGIN, doc.y);
        doc.moveDown(0.3);
        for (const item of warnings) {
          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor(item.severity === 'HIGH' ? DANGER : SLATE)
            .text(`• [${item.severity}] ${item.message}`, PAGE_MARGIN, doc.y, { width: 495 });
        }
      }

      // ---- footer ---------------------------------------------------
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(SLATE)
        .text(
          `Generated by ${env.COMPANY_NAME} on ${new Date().toISOString().slice(0, 10)}. This is a system-generated document.`,
          PAGE_MARGIN,
          780,
          { width: 495, align: 'center' },
        );

      doc.end();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

function horizontalRule(doc: any): void {
  doc
    .strokeColor(LINE)
    .lineWidth(1)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(COLUMN.amount, doc.y)
    .stroke();
}

function drawDetailColumn(
  doc: any,
  rows: Array<[string, string]>,
  x: number,
  top: number,
): void {
  rows.forEach(([label, value], index) => {
    const y = top + index * 16;
    doc.fontSize(9).font('Helvetica').fillColor(SLATE).text(label, x, y, { width: 100 });
    doc.fontSize(10).font('Helvetica-Bold').fillColor(INK).text(value, x + 105, y, { width: 130 });
  });
}

function summaryRow(doc: any, label: string, value: number, danger: boolean): void {
  const y = doc.y;
  doc.fontSize(10).font('Helvetica').fillColor(SLATE).text(label, COLUMN.label, y);
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor(danger ? DANGER : INK)
    .text(formatMoney(value), 380, y, { width: COLUMN.amount - 380, align: 'right' });
  doc.y = y + 16;
}
