import { jsPDF } from 'jspdf';
import { formatPKR } from '../../server/services/payrollCalculations.js';

export interface PayslipPdfData {
  companyName: string;
  companyAddress?: string;
  month: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  designation: string;
  joinDate?: string;
  basicSalary: number;
  grossSalary: number;
  hra: number;
  medicalAllowance: number;
  otherAllowance: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  absentDeduction: number;
  halfDayDeduction: number;
  taxDeduction: number;
  otherDeductions: number;
  netSalary: number;
  generatedAt: string;
}

export function generatePayslipPdf(data: PayslipPdfData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Colors
  const navy = [11, 17, 32];
  const gold = [214, 180, 106];
  const graphite = [30, 41, 59];
  const slate = [100, 116, 139];

  // Header Background Bar
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Gold accent line
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(0, 40, pageWidth, 2, 'F');

  // Company Name & Header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName || 'HCM Lite Enterprises', 14, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(data.companyAddress || 'Head Office, Karachi, Pakistan', 14, 28);
  doc.text(`Official Confidential Payslip - ${data.month}`, 14, 34);

  // Status Badge on Header Right
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.roundedRect(pageWidth - 55, 15, 41, 12, 2, 2, 'F');
  doc.setTextColor(11, 17, 32);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('FINALIZED', pageWidth - 47, 23);

  // Employee Information Box
  let y = 52;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 36, 2, 2, 'FD');

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Information', 20, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slate[0], slate[1], slate[2]);

  // Col 1
  doc.text(`Name: ${data.employeeName}`, 20, y + 17);
  doc.text(`Employee Code: ${data.employeeCode}`, 20, y + 25);
  doc.text(`Department: ${data.department}`, 20, y + 33);

  // Col 2
  const midCol = pageWidth / 2;
  doc.text(`Designation: ${data.designation}`, midCol, y + 17);
  doc.text(`Pay Period: ${data.month}`, midCol, y + 25);
  doc.text(`Generated: ${new Date(data.generatedAt).toLocaleDateString()}`, midCol, y + 33);

  // Attendance Summary Section
  y = 96;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('Working & Attendance Summary', 14, y);

  y += 4;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 14, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(slate[0], slate[1], slate[2]);
  doc.setFont('helvetica', 'normal');

  const attWidth = (pageWidth - 28) / 5;
  doc.text(`Working Days: ${data.workingDays}`, 16, y + 9);
  doc.text(`Present Days: ${data.presentDays}`, 16 + attWidth, y + 9);
  doc.text(`Half Days: ${data.halfDays}`, 16 + attWidth * 2, y + 9);
  doc.text(`Leave Days: ${data.leaveDays}`, 16 + attWidth * 3, y + 9);
  doc.text(`Absent Days: ${data.absentDays}`, 16 + attWidth * 4, y + 9);

  // Earnings & Deductions Tables Side-by-Side
  y = 122;
  const tableW = (pageWidth - 32) / 2;

  // Earnings Header
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(14, y, tableW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('EARNINGS', 18, y + 5.5);
  doc.text('AMOUNT (PKR)', 14 + tableW - 30, y + 5.5);

  // Deductions Header
  doc.rect(18 + tableW, y, tableW, 8, 'F');
  doc.text('DEDUCTIONS', 22 + tableW, y + 5.5);
  doc.text('AMOUNT (PKR)', 18 + tableW * 2 - 30, y + 5.5);

  // Rows
  const earnings = [
    { label: 'Basic Salary', val: data.basicSalary },
    { label: 'House Rent Allowance (40%)', val: data.hra },
    { label: 'Medical Allowance (10%)', val: data.medicalAllowance },
    { label: 'Other Allowances', val: data.otherAllowance },
  ];

  const deductions = [
    { label: 'Absent Deductions', val: data.absentDeduction },
    { label: 'Half-Day Deductions', val: data.halfDayDeduction },
    { label: 'Income Tax (Monthly)', val: data.taxDeduction },
    { label: 'Other Deductions', val: data.otherDeductions },
  ];

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(graphite[0], graphite[1], graphite[2]);
  doc.setFontSize(8.5);

  for (let i = 0; i < 4; i++) {
    const rowY = y + (i * 9);
    // Alternate row shading
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, rowY, tableW, 9, 'F');
      doc.rect(18 + tableW, rowY, tableW, 9, 'F');
    }
    // Earnings
    doc.text(earnings[i].label, 18, rowY + 6);
    doc.text(formatPKR(earnings[i].val), 14 + tableW - 8, rowY + 6, { align: 'right' });

    // Deductions
    doc.text(deductions[i].label, 22 + tableW, rowY + 6);
    doc.text(formatPKR(deductions[i].val), 18 + tableW * 2 - 8, rowY + 6, { align: 'right' });
  }

  // Subtotal Bars
  y += 36;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, tableW, 9, 'F');
  doc.rect(18 + tableW, y, tableW, 9, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Gross Earnings', 18, y + 6);
  doc.text(formatPKR(data.grossSalary), 14 + tableW - 8, y + 6, { align: 'right' });

  const totalDeductions = data.absentDeduction + data.halfDayDeduction + data.taxDeduction + data.otherDeductions;
  doc.text('Total Deductions', 22 + tableW, y + 6);
  doc.text(formatPKR(totalDeductions), 18 + tableW * 2 - 8, y + 6, { align: 'right' });

  // Net Salary Callout Box
  y += 18;
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.roundedRect(14, y, pageWidth - 28, 24, 2, 2, 'F');

  // Gold Trim
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(14, y, 4, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('NET SALARY PAYABLE (PKR)', 24, y + 10);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(formatPKR(data.netSalary), 24, y + 19);

  // Footer / Disclaimer
  y = 265;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, pageWidth - 14, y);

  doc.setFontSize(7.5);
  doc.setTextColor(slate[0], slate[1], slate[2]);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'This is a computer-generated payslip from HCM Lite and requires no physical signature. Tax calculated according to Pakistan Income Tax Ordinance.',
    14,
    y + 6
  );
  doc.text(`Generated on ${new Date().toLocaleString()} for ${data.employeeName} (${data.employeeCode})`, 14, y + 11);

  // Trigger download
  doc.save(`Payslip_${data.employeeCode}_${data.month}.pdf`);
}
