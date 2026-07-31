import OpenAI from 'openai';
import { AppError } from '../utils/errors.js';
let client;
export function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) throw new AppError('OPENAI_NOT_CONFIGURED', 'OPENAI_API_KEY ist auf Render nicht eingerichtet.', 503);
  client ||= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}
export function inspectResponse(response) {
  if (!response) throw new AppError('OPENAI_EMPTY_RESPONSE', 'Die KI hat keine Antwort geliefert.', 502);
  if (response.status === 'incomplete') throw new AppError('OPENAI_INCOMPLETE_RESPONSE', 'Die Bildanalyse wurde unvollständig beendet.', 502, response.incomplete_details);
  if (response.status === 'failed') throw new AppError('OPENAI_FAILED_RESPONSE', 'Die KI-Anfrage ist fehlgeschlagen.', 502, response.error);
  return response.output_text?.trim() || '';
}
