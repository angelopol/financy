import { Injectable, ServiceUnavailableException, HttpException } from '@nestjs/common';
export const AI_MODEL='gemini-3.5-flash-lite';
export const MAX_CONTEXT_BYTES=160_000;
export interface GeminiContent { role:'user'|'model'; parts:any[]; }
@Injectable()
export class GeminiService {
  get configured(){return Boolean(process.env.GEMINI_API_KEY?.trim());}
  async generate(system:string,contents:GeminiContent[],signal:AbortSignal,tools?:any[]) {
    if(!this.configured)throw new ServiceUnavailableException('El asistente todavía no está configurado. Falta la clave de Gemini en el servidor.');
    const body={systemInstruction:{parts:[{text:system}]},contents,generationConfig:{maxOutputTokens:4096,temperature:0.4},...(tools?.length?{tools:[{functionDeclarations:tools}]}:{})};
    if(Buffer.byteLength(JSON.stringify(body))>MAX_CONTEXT_BYTES)throw new HttpException('La consulta abarca demasiada información. Acota el período o divide la pregunta.',422);
    let response:Response;
    try{response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY!},body:JSON.stringify(body),signal});}
    catch{throw new ServiceUnavailableException('Gemini tardó demasiado en responder. Puedes reintentar tu mensaje.');}
    if(response.status===429)throw new HttpException('Gemini alcanzó su límite de solicitudes. Intenta de nuevo en unos momentos.',429);
    if(!response.ok)throw new ServiceUnavailableException('No se pudo consultar Gemini. Revisa la configuración y disponibilidad del modelo.');
    const json=await response.json();const candidate=json.candidates?.[0];
    if(!candidate?.content?.parts?.length||candidate.finishReason&&candidate.finishReason!=='STOP')throw new ServiceUnavailableException('Gemini no devolvió una respuesta completa. Reformula o acota tu pregunta.');
    return candidate.content as GeminiContent;
  }
}
