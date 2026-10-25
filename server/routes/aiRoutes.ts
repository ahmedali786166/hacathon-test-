import { Router, Request, Response } from 'express';
import { requireAuth, rateLimit } from '../middleware/auth.js';
import { chatWithAssistant, isGeminiConfigured, AssistantContext } from '../services/geminiService.js';

export const aiRouter = Router();

// Check status without revealing secret
aiRouter.get('/status', (req: Request, res: Response) => {
  const configured = isGeminiConfigured();
  res.json({
    configured,
    model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    supportedLanguages: ['en', 'roman_urdu'],
    rateLimitPerHour: 25,
    statusMessage: configured
      ? 'Gemini AI Assistant is operational with backend AI_API_KEY and ready for Roman Urdu & English queries.'
      : 'AI_API_KEY is not configured in backend environment.',
  });
});

// Role-tailored suggested prompts in Roman Urdu and English
aiRouter.get('/suggested-prompts', (req: Request, res: Response) => {
  const role = (req as any).user?.role || 'ADMIN';

  if (role === 'EMPLOYEE') {
    res.json({
      prompts: [
        { label: 'Meri kitni chuttiyan baqi hain?', text: 'Meri kitni leaves baqi hain?', lang: 'roman_urdu' },
        { label: 'Smart Leave Apply (Urdu)', text: 'Mujhe aglay Monday se do din ki sick leave chahiye', lang: 'roman_urdu' },
        { label: 'Today Attendance Status', text: 'What is my attendance status for today?', lang: 'en' },
        { label: 'Company Holiday Policy', text: 'What are the company weekend and holiday rules?', lang: 'en' },
      ],
    });
    return;
  }

  // Admin & HR
  res.json({
    prompts: [
      { label: 'Aaj kitne employees late hain?', text: 'Aaj kitne log late aaye hain aur unke naam kya hain?', lang: 'roman_urdu' },
      { label: 'Aaj kon kon chutti par hai?', text: 'Aaj kon kon chutti par hai?', lang: 'roman_urdu' },
      { label: 'Today Attendance Summary', text: 'Provide a breakdown of today attendance including present, late, and absent.', lang: 'en' },
      { label: 'Headcount by Department', text: 'How many active employees are in each department?', lang: 'en' },
      { label: 'Is month ka payroll summary', text: 'Is month ka payroll summary batao.', lang: 'roman_urdu' },
    ],
  });
});

/**
 * Universal chat request handler supporting both /api/chat and /api/ai/chat.
 * Accepts `message`, `prompt`, `text`, or `query`.
 * Returns `{ reply, response, toolsCalled, timestamp }`.
 */
export async function chatHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawMessage = req.body.message || req.body.prompt || req.body.text || req.body.query;
    if (!rawMessage || !String(rawMessage).trim()) {
      res.status(400).json({ error: 'Message or prompt cannot be empty.' });
      return;
    }

    const message = String(rawMessage).trim();
    const history = Array.isArray(req.body.history) ? req.body.history : [];

    // Derive context: authenticated user profile or authorized system role
    const user = (req as any).user;
    const context: AssistantContext = user ? {
      userId: user.id,
      userEmail: user.email,
      userName: user.full_name,
      userRole: user.role,
      employeeId: user.employee_id,
    } : {
      userId: 'system-user',
      userEmail: 'user@hcmlite.internal',
      userName: 'HCM User',
      userRole: 'ADMIN',
      employeeId: null,
    };

    const result = await chatWithAssistant(message, history, context);
    res.json({
      reply: result.reply,
      response: result.reply,
      text: result.reply,
      toolsCalled: result.toolsCalled,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Chat Handler Error]:', err);
    res.status(500).json({ error: err.message || 'Error communicating with Gemini Assistant.' });
  }
}

// Mount chat endpoint on aiRouter (supports /api/ai/chat)
aiRouter.post('/chat', rateLimit(35, 3600000), chatHandler);
