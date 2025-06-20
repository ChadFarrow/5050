// Minimal test API
export default function handler(req: any, res: any) {
  return res.status(200).json({ 
    message: 'Simple test works!',
    timestamp: Date.now()
  });
}