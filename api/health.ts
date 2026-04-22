import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
    const hasApiKey = !!process.env.GEMINI_API_KEY;
    return res.status(200).json({
        status: 'ok',
        gemini_key_present: hasApiKey,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
}
