import { Router } from 'express';
import { z } from 'zod';
import { researchProduct } from '../services/research.js';
const router=Router();
const schema=z.object({manufacturer:z.string().max(200).optional().default(''),productFamily:z.string().max(300).optional().default(''),partNumber:z.string().max(200).optional().default(''),model:z.string().max(200).optional().default(''),serialNumber:z.string().max(200).optional().default(''),rawText:z.string().max(4000).optional().default(''),mode:z.enum(['identify','troubleshoot','documents','replacement']).optional().default('identify')});
router.post('/product',async(req,res,next)=>{try{res.json(await researchProduct(schema.parse(req.body)));}catch(e){next(e);}});
export default router;
