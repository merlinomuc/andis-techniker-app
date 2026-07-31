import { Router } from 'express';
import { z } from 'zod';
import { readVision } from '../services/vision.js';
const router=Router();
const schema=z.object({query:z.string().max(1000).optional().default(''),focus:z.enum(['auto','device','label','display']).optional().default('auto'),images:z.array(z.string().startsWith('data:image/').max(9_000_000)).min(1).max(4)});
router.post('/read',async(req,res,next)=>{try{res.json(await readVision(schema.parse(req.body)));}catch(e){next(e);}});
export default router;
