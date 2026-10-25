import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { query, queryOne, run } from '../db/database.js';
import { calculateWorkingDaysBetween } from './workingDaysService.js';
import crypto from 'crypto';

export interface AssistantContext {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
  employeeId?: string | null;
}

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.AI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'MY_AI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  const key = (process.env.AI_API_KEY || process.env.GEMINI_API_KEY || '').trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key !== 'MY_AI_API_KEY');
}

/**
 * Model invoker with automatic fallback to avoid quota or model-specific errors.
 */
export async function generateWithFallback(ai: GoogleGenAI, options: any): Promise<any> {
  const candidateModels = [
    process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ];
  const uniqueModels = Array.from(new Set(candidateModels));
  let lastError: any = null;

  for (const model of uniqueModels) {
    try {
      const res = await ai.models.generateContent({
        ...options,
        model,
      });
      return res;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini] Model ${model} encountered error:`, err?.status || err?.message || err);
      // If quota exhausted (429) or model unavailable (404), try next model in loop
      if (
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('quota') ||
        err?.status === 404
      ) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// System instructions enforcing conversational Roman Urdu, database tool boundaries, and role permissions
const SYSTEM_INSTRUCTION = `
You are the intelligent, polite, and helpful HR & Operations Assistant for "HCM Lite", a Human Capital Management system.
Current Local Date: 2026-10-24. Company Timezone: Asia/Karachi (Pakistan Standard Time, UTC+5).

ROMAN URDU COMMUNICATION MANDATE (CRITICAL):
- When the user asks, greets, or talks in Roman Urdu (e.g. "Salam", "Mujhe chutti chahiye", "Aaj kitne log late hain?", "Meri salary kitni hai?", "Mausam kaisa hai", "Company ke rules batao", etc.), YOU MUST CONVERSE NATURALLY, WARMLY, AND CONVERSATIONALLY IN FLUENT ROMAN URDU!
- Write Roman Urdu strictly in Latin English characters (e.g. "Walaikum Assalam! Main aapki kya madad kar sakta hoon?"). NEVER output Nastaliq or Arabic script.
- Talk like a supportive, knowledgeable Pakistani HR colleague: friendly, polite, empathetic, and clear.
- Understand common Pakistani corporate/workplace Roman Urdu terms:
  - "chutti" / "chuttiyan" / "rukhsat" = leaves / holidays
  - "hazir" = present, "ghair hazir" = absent
  - "baki" / "baqi" = remaining balance
  - "tankhwah" / "salary" = salary/payroll
  - "aaj" = today (2026-10-24)
  - "kal" = tomorrow (or yesterday depending on context)
  - "aglay somwar / aglay monday" = next Monday
  - "kitne log / mulazmeen" = headcount / staff
- If the user communicates in English, respond warmly in fluent English.
- If the user code-switches (mixes English and Urdu), match their tone and language naturally.

DATA INTEGRITY & REAL-TIME TOOL USAGE:
- You have backend tool functions available to query real data. Always call the corresponding tool when asked about:
  1. Total headcount / department breakdown -> get_headcount
  2. Today's attendance summary (present, late, absent) -> get_attendance_summary
  3. Late comers list -> get_late_comers
  4. Employees on approved leave -> get_leave_summary
  5. Personal leave balance -> get_my_leave_balance
  6. Monthly payroll summary -> get_payroll_summary
  7. Search employees -> search_employees
- When a tool returns data, synthesize the facts into a helpful, conversational response in Roman Urdu or English.
- Never fabricate numbers or names that are not in the tool results.
- For general conversation, greetings, advice, or policy discussions, respond directly and dynamically without calling tools.

ROLE-BASED SCOPE & CONFIDENTIALITY:
- If an EMPLOYEE asks to view another employee's salary, bonus, payslip, or personal earnings (e.g., "Ali ki salary batao", "Colleague ki tankhwah kya hai?"), STRICTLY REFUSE politely:
  Roman Urdu: "Maaf kijiye, company policy ke tehat aap kisi doosre employee ki confidential salary ya private records nahi dekh sakte."
  English: "I apologize, but company policy restricts viewing confidential salary details of other employees."
- Employees may only view their own leave balances and personal attendance.
- Admin and HR roles have authorized access to organization-wide summaries.
- Currency format: Format Pakistani amounts in PKR (Pakistani Rupees).
`;

// AI Tool definitions
const getHeadcountDecl: FunctionDeclaration = {
  name: 'get_headcount',
  description: 'Get total headcount and active employee count across departments',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const getAttendanceSummaryDecl: FunctionDeclaration = {
  name: 'get_attendance_summary',
  description: 'Get attendance metrics (present, late, half-day, absent) for a specific date (defaults to today)',
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: {
        type: Type.STRING,
        description: 'Date in YYYY-MM-DD format. Defaults to today (2026-10-24).',
      },
    },
  },
};

const getLateComersDecl: FunctionDeclaration = {
  name: 'get_late_comers',
  description: 'List employees who arrived late (after 09:15) for a specified date',
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: {
        type: Type.STRING,
        description: 'Date in YYYY-MM-DD format. Defaults to today.',
      },
    },
  },
};

const getLeaveSummaryDecl: FunctionDeclaration = {
  name: 'get_leave_summary',
  description: 'Get approved employees on leave for a given date or today',
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: {
        type: Type.STRING,
        description: 'Date in YYYY-MM-DD format. Defaults to today.',
      },
    },
  },
};

const getMyLeaveBalanceDecl: FunctionDeclaration = {
  name: 'get_my_leave_balance',
  description: 'Get current leave balances and quotas for the calling employee',
  parameters: {
    type: Type.OBJECT,
    properties: {},
  },
};

const getPayrollSummaryDecl: FunctionDeclaration = {
  name: 'get_payroll_summary',
  description: 'Get payroll summary for a given month (YYYY-MM). Requires HR or Admin role.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      month: {
        type: Type.STRING,
        description: 'Month in YYYY-MM format, e.g. 2026-10',
      },
    },
  },
};

const searchEmployeesDecl: FunctionDeclaration = {
  name: 'search_employees',
  description: 'Search employees by name, department, or employee code',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Search term for employee name or code',
      },
    },
  },
};

// Tool execution logic enforcing RBAC
async function executeAiTool(name: string, args: any, ctx: AssistantContext): Promise<any> {
  const todayStr = '2026-10-24';

  switch (name) {
    case 'get_headcount': {
      if (ctx.userRole === 'EMPLOYEE') {
        const row = queryOne<any>('SELECT count(1) as total FROM employees WHERE status = "ACTIVE"');
        return { totalActiveEmployees: row?.total || 0 };
      }
      const total = queryOne<any>('SELECT count(1) as c FROM employees');
      const active = queryOne<any>('SELECT count(1) as c FROM employees WHERE status = "ACTIVE"');
      const byDept = query<any>(`
        SELECT d.name as department, count(e.id) as count 
        FROM departments d 
        LEFT JOIN employees e ON e.department_id = d.id AND e.status = 'ACTIVE'
        GROUP BY d.id
      `);
      return {
        totalEmployees: total?.c || 0,
        activeEmployees: active?.c || 0,
        departments: byDept,
      };
    }

    case 'get_attendance_summary': {
      const targetDate = args?.date || todayStr;
      if (ctx.userRole === 'EMPLOYEE') {
        if (!ctx.employeeId) return { error: 'No employee record linked to your user account.' };
        const myAtt = queryOne<any>(
          'SELECT status, check_in_time, check_out_time, total_working_hours FROM attendance WHERE employee_id = ? AND date = ?',
          [ctx.employeeId, targetDate]
        );
        return {
          date: targetDate,
          myAttendance: myAtt || { status: 'Not checked in yet' },
        };
      }

      const totalEmployees = queryOne<any>('SELECT count(1) as c FROM employees WHERE status = "ACTIVE"')?.c || 0;
      const records = query<any>('SELECT status, count(1) as count FROM attendance WHERE date = ? GROUP BY status', [targetDate]);
      const counts: Record<string, number> = {
        PRESENT: 0,
        LATE: 0,
        HALF_DAY: 0,
        ABSENT: 0,
        ON_LEAVE: 0,
      };
      records.forEach(r => {
        counts[r.status] = r.count;
      });
      const recordedCount = Object.values(counts).reduce((a, b) => a + b, 0);
      const unrecorded = Math.max(0, totalEmployees - recordedCount);

      return {
        date: targetDate,
        totalActiveEmployees: totalEmployees,
        present: counts.PRESENT + counts.LATE,
        onTime: counts.PRESENT,
        late: counts.LATE,
        halfDay: counts.HALF_DAY,
        onLeave: counts.ON_LEAVE,
        absent: counts.ABSENT + unrecorded,
      };
    }

    case 'get_late_comers': {
      const targetDate = args?.date || todayStr;
      if (ctx.userRole === 'EMPLOYEE') {
        return { error: 'Access denied. Only HR and Admin can view other employees late arrivals.' };
      }
      const lateList = query<any>(`
        SELECT e.employee_code, e.first_name || ' ' || e.last_name as name, d.name as department, a.check_in_time 
        FROM attendance a
        JOIN employees e ON e.id = a.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        WHERE a.date = ? AND a.status = 'LATE'
      `, [targetDate]);

      return {
        date: targetDate,
        lateCount: lateList.length,
        employees: lateList,
      };
    }

    case 'get_leave_summary': {
      const targetDate = args?.date || todayStr;
      const leaves = query<any>(`
        SELECT e.first_name || ' ' || e.last_name as name, d.name as department, lt.name as leave_type, lr.start_date, lr.end_date
        FROM leave_requests lr
        JOIN employees e ON e.id = lr.employee_id
        LEFT JOIN departments d ON d.id = e.department_id
        JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.status = 'APPROVED' AND ? BETWEEN lr.start_date AND lr.end_date
      `, [targetDate]);

      return {
        date: targetDate,
        totalOnLeave: leaves.length,
        employeesOnLeave: leaves.map(l => ({
          name: l.name,
          department: l.department,
          leaveType: l.leave_type,
          from: l.start_date,
          to: l.end_date,
        })),
      };
    }

    case 'get_my_leave_balance': {
      if (!ctx.employeeId) {
        return { error: 'No employee profile linked to current account.' };
      }
      const currentYear = new Date(todayStr).getFullYear();
      const balances = query<any>(`
        SELECT lt.name as leave_type, lt.code, lb.total_days, lb.used_days, lb.pending_days, (lb.total_days - lb.used_days) as remaining_days
        FROM leave_balances lb
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        WHERE lb.employee_id = ? AND lb.year = ?
      `, [ctx.employeeId, currentYear]);

      return {
        employeeName: ctx.userName,
        year: currentYear,
        balances,
      };
    }

    case 'get_payroll_summary': {
      if (ctx.userRole !== 'ADMIN' && ctx.userRole !== 'HR') {
        return {
          error: 'Access denied: You do not have permission to view confidential company payroll data.',
        };
      }
      const month = args?.month || todayStr.substring(0, 7);
      const run = queryOne<any>('SELECT * FROM payroll_runs WHERE month = ?', [month]);
      if (!run) {
        return {
          month,
          status: 'No payroll run prepared yet for this month.',
        };
      }
      return {
        month,
        status: run.status,
        totalGross: run.total_gross,
        totalNet: run.total_net,
        totalTax: run.total_tax,
        totalDeductions: run.total_deductions,
      };
    }

    case 'search_employees': {
      const q = `%${(args?.query || '').trim()}%`;
      const rows = query<any>(`
        SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, d.name as department, des.title as designation, e.status, e.basic_salary
        FROM employees e
        LEFT JOIN departments d ON d.id = e.department_id
        LEFT JOIN designations des ON des.id = e.designation_id
        WHERE e.first_name LIKE ? OR e.last_name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ?
        LIMIT 10
      `, [q, q, q, q]);

      // STRICT CONFIDENTIALITY: Mask basic_salary if caller is standard employee
      return rows.map(r => ({
        id: r.id,
        code: r.employee_code,
        name: `${r.first_name} ${r.last_name}`,
        email: r.email,
        department: r.department,
        designation: r.designation,
        status: r.status,
        salary: (ctx.userRole === 'ADMIN' || ctx.userRole === 'HR') ? r.basic_salary : '[CONFIDENTIAL - ACCESS RESTRICTED]',
      }));
    }

    default:
      return { error: `Tool ${name} not recognized` };
  }
}

/**
 * Executes a conversational turn with Gemini with tools & strict RBAC.
 * Dynamically queries the Gemini API and returns real model responses in Roman Urdu or English.
 */
export async function chatWithAssistant(
  message: string,
  history: Array<{ role: 'user' | 'model'; text: string }>,
  ctx: AssistantContext
): Promise<{ reply: string; toolsCalled: string[] }> {
  const startTime = Date.now();
  const toolsCalledList: string[] = [];
  const ai = getGeminiClient();

  if (!ai) {
    const errorMsg = ctx.userRole === 'ADMIN'
      ? 'Gemini API Key is not configured. Please ensure AI_API_KEY is defined in backend environment.'
      : 'AI Assistant is temporarily offline. Please contact your system administrator.';
    throw new Error(errorMsg);
  }

  // Detect language hint for telemetry logging
  const romanUrduKeywords = ['aaj', 'kal', 'meri', 'mera', 'chutti', 'chuttiyan', 'kitne', 'salary', 'hazir', 'ghair hazir', 'baki', 'batao', 'karo', 'hai', 'hain', 'mujhe', 'salam'];
  const isRomanUrdu = romanUrduKeywords.some(kw => message.toLowerCase().includes(kw));

  try {
    const tools = [
      getHeadcountDecl,
      getAttendanceSummaryDecl,
      getLateComersDecl,
      getLeaveSummaryDecl,
      getMyLeaveBalanceDecl,
      getPayrollSummaryDecl,
      searchEmployeesDecl,
    ];

    // Build contents from conversation history
    const contents: any[] = history.map(h => ({
      role: h.role === 'model' ? 'model' : 'user',
      parts: [{ text: h.text }],
    }));
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const callerDetails = `\nCaller Details: Name=${ctx.userName}, Email=${ctx.userEmail}, Role=${ctx.userRole}, EmployeeId=${ctx.employeeId || 'None'}`;

    const response = await generateWithFallback(ai, {
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION + callerDetails,
        tools: [{ functionDeclarations: tools }],
      },
    });

    let finalAnswer = '';
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      // Execute each function call with authenticated role checks
      const toolResponsesParts: any[] = [];
      for (const fc of functionCalls) {
        if (!fc.name) continue;
        toolsCalledList.push(fc.name);
        const result = await executeAiTool(fc.name, fc.args, ctx);
        toolResponsesParts.push({
          functionResponse: {
            name: fc.name,
            response: { output: result },
          },
        });
      }

      // Pass function outputs back to model to synthesize natural Roman Urdu response
      const secondCallContents = [
        ...contents,
        response.candidates?.[0]?.content,
        {
          role: 'user',
          parts: toolResponsesParts,
        },
      ];

      const secondResponse = await generateWithFallback(ai, {
        contents: secondCallContents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION + callerDetails,
        },
      });

      finalAnswer = secondResponse.text || '';
    } else {
      finalAnswer = response.text || '';
    }

    const latency = Date.now() - startTime;

    // Log to ai_logs table for auditability
    try {
      run(
        `INSERT INTO ai_logs (id, user_id, prompt_summary, language, tools_called, outcome, latency_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          ctx.userId,
          message.substring(0, 200),
          isRomanUrdu ? 'roman_urdu' : 'en',
          JSON.stringify(toolsCalledList),
          'SUCCESS',
          latency,
          new Date().toISOString(),
        ]
      );
    } catch (e) {
      console.error('Error logging ai interaction:', e);
    }

    return { reply: finalAnswer, toolsCalled: toolsCalledList };
  } catch (error: any) {
    console.error('Gemini API call failed:', error?.message || error);
    const latency = Date.now() - startTime;
    const errorDetails = error?.message || String(error);

    try {
      run(
        `INSERT INTO ai_logs (id, user_id, prompt_summary, language, tools_called, outcome, latency_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          ctx.userId,
          message.substring(0, 200),
          isRomanUrdu ? 'roman_urdu' : 'en',
          JSON.stringify(toolsCalledList),
          `ERROR: ${errorDetails}`,
          latency,
          new Date().toISOString(),
        ]
      );
    } catch {}

    // Transparent error propagation: never hide failures behind static dummy messages!
    throw new Error(`Gemini AI service error: ${errorDetails}`);
  }
}

/**
 * Smart Leave Parser:
 * Extracts leave details from Roman Urdu or English user statements.
 * Returns prefilled form parameters for user review and explicit submission.
 */
export async function parseSmartLeaveRequest(
  text: string,
  ctx: AssistantContext
): Promise<{
  leaveTypeId: string | null;
  leaveTypeName: string | null;
  startDate: string | null;
  endDate: string | null;
  totalWorkingDays: number;
  reason: string;
  interpretationSummary: string;
  availableBalance: number;
}> {
  const leaveTypes = query<any>('SELECT id, name, code FROM leave_types');

  let availableBalance = 0;
  const currentYear = 2026;

  const prompt = `
You are an intelligent HR assistant parsing a natural language leave application in English or Roman Urdu.
Today's Date: 2026-10-24 (Saturday).
Company Leave Types Available: ${JSON.stringify(leaveTypes)}

User Prompt: "${text}"

Instructions:
Extract the following in JSON format:
- leave_type_name: matching one of the available leave types (e.g. "Annual Leave", "Sick Leave", "Casual Leave", or "Unpaid Leave").
- start_date: ISO date YYYY-MM-DD. If user says "next Monday", calculate it based on today (2026-10-24 is Saturday, so next Monday is 2026-10-26). If user says "kal", calculate based on context.
- end_date: ISO date YYYY-MM-DD. If user says "for two days" starting Monday, end date is Tuesday 2026-10-27.
- reason: clean summary of reason in the user's language or English.
- summary: short friendly 1-sentence interpretation in Roman Urdu or English (e.g. "Sick Leave for 2 days from Oct 26 to Oct 27, 2026").

Respond strictly in valid JSON matching this schema:
{
  "leave_type_name": string,
  "start_date": string,
  "end_date": string,
  "reason": string,
  "summary": string
}
`;

  const ai = getGeminiClient();
  let parsed: any = null;

  if (ai) {
    try {
      const response = await generateWithFallback(ai, {
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      parsed = JSON.parse(response.text?.trim() || '{}');
    } catch (e) {
      console.error('Error with Gemini smart leave parser:', e);
    }
  }

  // Fallback heuristics if Gemini is unavailable
  if (!parsed || !parsed.start_date) {
    const isSick = text.toLowerCase().includes('sick') || text.toLowerCase().includes('bimar') || text.toLowerCase().includes('tabiyat');
    const isCasual = text.toLowerCase().includes('casual') || text.toLowerCase().includes('kaam');
    const matchedType = leaveTypes.find(lt => isSick ? lt.code === 'SICK' : (isCasual ? lt.code === 'CASUAL' : lt.code === 'ANNUAL')) || leaveTypes[0];

    const startDate = '2026-10-26';
    const duration = text.includes('3') || text.includes('teen') ? 3 : (text.includes('2') || text.includes('do') ? 2 : 1);
    const endDate = duration === 1 ? '2026-10-26' : (duration === 2 ? '2026-10-27' : '2026-10-28');

    parsed = {
      leave_type_name: matchedType ? matchedType.name : 'Casual Leave',
      start_date: startDate,
      end_date: endDate,
      reason: text,
      summary: `Requested leave from ${startDate} to ${endDate}`,
    };
  }

  // Match leave type ID
  let matchedLeaveType = leaveTypes.find(
    lt => lt.name.toLowerCase() === (parsed.leave_type_name || '').toLowerCase()
  );
  if (!matchedLeaveType && leaveTypes.length > 0) {
    matchedLeaveType = leaveTypes[0];
  }

  // Calculate working days
  const startDate = parsed.start_date || '2026-10-26';
  const endDate = parsed.end_date || startDate;
  const { workingDays } = calculateWorkingDaysBetween(startDate, endDate);

  // Look up available balance for calling employee
  if (ctx.employeeId && matchedLeaveType) {
    const balRow = queryOne<any>(
      'SELECT total_days, used_days FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
      [ctx.employeeId, matchedLeaveType.id, currentYear]
    );
    if (balRow) {
      availableBalance = Math.max(0, balRow.total_days - balRow.used_days);
    }
  }

  return {
    leaveTypeId: matchedLeaveType ? matchedLeaveType.id : null,
    leaveTypeName: matchedLeaveType ? matchedLeaveType.name : 'Leave',
    startDate,
    endDate,
    totalWorkingDays: Math.max(1, workingDays),
    reason: parsed.reason || text,
    interpretationSummary: parsed.summary || `${matchedLeaveType?.name || 'Leave'} for ${workingDays} working day(s)`,
    availableBalance,
  };
}
