// Simple test API to verify Vercel functions are working
import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const botNsec = process.env.PODRAFFLE_BOT_NSEC;
  
  return res.status(200).json({ 
    message: 'API is working!',
    method: req.method,
    hasBotNsec: !!botNsec,
    botNsecLength: botNsec ? botNsec.length : 0,
    botNsecPrefix: botNsec ? botNsec.substring(0, 10) + '...' : 'none'
  });
}