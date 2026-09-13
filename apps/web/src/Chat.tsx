import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MessageCircle, X, Send, Sparkles, Trash2, LoaderCircle, ArrowUp, RefreshCw, Check, Ban } from 'lucide-react';
import Markdown from 'react-markdown';
import { api } from './api';
type Action={id:string;kind:string;summary:string;status:'pending'|'executing'|'confirmed'|'cancelled'};
type Message={id:string;role:'user'|'model';content:string;context_at?:string;request_id:string;action?:Action};
export function Chat(){
  const [open,setOpen]=useState(false),[messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[configured,setConfigured]=useState(true),[hasMore,setHasMore]=useState(false),[confirmClear,setConfirmClear]=useState(false),[loaded,setLoaded]=useState(false),[resolving,setResolving]=useState('');
  const pending=useRef<{request_id:string;message:string}|null>(null),dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLTextAreaElement>(null),end=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function load(older=false){setLoading(true);setError('');try{const data=await api('/ai/messages'+(older&&messages.length?'?before='+messages[0].id:''));if(!alive.current)return;setMessages(prev=>older?[...data.messages,...prev]:data.messages);setHasMore(data.has_more);setConfigured(data.configured);setLoaded(true);}catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setLoading(false);}}
  useEffect(()=>{if(open){dialog.current?.showModal();if(!loaded)void load();input.current?.focus();}else if(dialog.current?.open){dialog.current.close();trigger.current?.focus();}},[open]);
  useEffect(()=>{if(open&&!loading)end.current?.scrollIntoView({block:'nearest'});},[messages.length,busy,open]);
  async function send(event?:FormEvent){event?.preventDefault();if(busy||!draft.trim()||!configured)return;
    const request=pending.current?.message===draft.trim()?pending.current:{request_id:crypto.randomUUID(),message:draft.trim()};pending.current=request;setBusy(true);setError('');
    try{const result=await api('/ai/messages','POST',request);if(!alive.current)return;setMessages(prev=>[...prev.filter(m=>m.request_id!==request.request_id),...result.messages]);setDraft('');pending.current=null;}catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current){setBusy(false);input.current?.focus();}}
  }
  function keydown(e:KeyboardEvent<HTMLTextAreaElement>){if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}
  async function resolveAction(actionId:string,decision:'confirm'|'cancel'){
    setResolving(actionId);setError('');
    try{
      await api('/ai/actions/'+actionId+'/'+decision,'POST',{});
      const status=decision==='confirm'?'confirmed':'cancelled';
      setMessages(prev=>prev.map(m=>m.action?.id===actionId?{...m,action:{...m.action,status}}:m));
      if(decision==='confirm')window.dispatchEvent(new CustomEvent('financy:reload',{detail:'Financy IA aplicó una acción. Tus finanzas están actualizadas.'}));
    }catch(e){setError((e as Error).message);}
    finally{setResolving('');}
  }
  async function clear(){setLoading(true);setError('');try{await api('/ai/messages','DELETE',{});setMessages([]);setHasMore(false);setDraft('');pending.current=null;setConfirmClear(false);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
  return <>
    <button ref={trigger} className="ai-fab" onClick={()=>setOpen(true)} aria-label="Hablar con Financy IA" aria-haspopup="dialog" aria-expanded={open}><MessageCircle size={23}/><span>Financy IA</span><i/></button>
    <dialog ref={dialog} className="chat-dialog" aria-labelledby="chat-title" onCancel={e=>{e.preventDefault();setOpen(false);}} onClick={e=>{if(e.target===dialog.current)setOpen(false);}}>
      <div className="chat-header"><span className="chat-brand"><Sparkles size={23}/></span><div><h2 id="chat-title">Tu copiloto financiero</h2><p>Financy IA · Gemini 3.5 Flash-Lite</p></div><button className="icon-button" aria-label="Borrar conversación y memoria" disabled={busy||loading} onClick={()=>setConfirmClear(true)}><Trash2 size={18}/></button><button className="icon-button" aria-label="Cerrar chat" onClick={()=>setOpen(false)}><X size={20}/></button></div>
      <div className="chat-context-note"><span className="online-dot"/> Contexto financiero actualizado en cada pregunta</div>
      {confirmClear&&<div className="chat-confirm" role="alert"><p>¿Borrar esta conversación y su memoria? Tus datos financieros se conservan.</p><button className="small-button" disabled={loading} onClick={()=>void clear()}>Sí, borrar conversación</button><button className="small-button" onClick={()=>setConfirmClear(false)}>Cancelar</button></div>}
      <div className="chat-scroll" aria-label="Conversación" role="log" aria-live="polite" aria-relevant="additions">
        {hasMore&&<button className="chat-older" disabled={loading||busy} onClick={()=>void load(true)}><ArrowUp size={15}/> Cargar mensajes anteriores</button>}
        {loading&&<p className="chat-status"><LoaderCircle className="spin" size={18}/> Cargando conversación…</p>}
        {!messages.length&&!loading&&<div className="chat-welcome"><span><Sparkles size={32}/></span><h3>Hablemos de tus planes.</h3><p>Pregúntame por tus gastos, ahorros o próximos compromisos. Consultaré tu información para ayudarte a entenderla.</p><div>{['¿Cómo están mis finanzas este mes?','¿En qué puedo reducir mis gastos?','¿Cuáles son mis próximos pagos?'].map(s=><button key={s} disabled={!configured} onClick={()=>{setDraft(s);input.current?.focus();}}>{s}<ArrowUp size={14}/></button>)}</div></div>}
        {messages.map(m=><article key={m.id} className={'chat-message '+m.role} aria-label={m.role==='user'?'Tú':'Financy IA'}><span className="chat-speaker">{m.role==='user'?'Tú':'Financy IA'}</span><div className="chat-markdown"><Markdown skipHtml components={{a:({children})=><span>{children}</span>,img:()=>null}}>{m.content}</Markdown></div>{m.action&&<div className={'chat-action '+m.action.status}>
          <p>{m.action.summary}</p>
          {(m.action.status==='pending'||m.action.status==='executing')&&<div>
            <button className="small-button" disabled={resolving===m.action.id} onClick={()=>void resolveAction(m.action!.id,'confirm')}><Check size={14}/> Confirmar</button>
            <button className="small-button" disabled={resolving===m.action.id} onClick={()=>void resolveAction(m.action!.id,'cancel')}><Ban size={14}/> Cancelar</button>
          </div>}
          {m.action.status==='confirmed'&&<span className="chat-action-status"><Check size={14}/> Aplicado</span>}
          {m.action.status==='cancelled'&&<span className="chat-action-status"><Ban size={14}/> Cancelado</span>}
        </div>}{m.role==='model'&&m.context_at&&<small>Datos consultados: {new Intl.DateTimeFormat('es-VE',{dateStyle:'short',timeStyle:'short',timeZone:'America/Caracas'}).format(new Date(m.context_at))}</small>}</article>)}
        {busy&&<><article className="chat-message user"><span className="chat-speaker">Tú</span><p>{pending.current?.message}</p></article><p className="chat-status" role="status"><LoaderCircle className="spin" size={18}/> Revisando tus finanzas y preparando una respuesta…</p></>}
        <div ref={end}/>
      </div>
      {!configured&&<p className="chat-error" role="status">El asistente está listo para conectarse. Configura la clave de Gemini en el servidor para comenzar.</p>}
      {error&&<div className="chat-error" role="alert">{error}{!loaded&&<button className="small-button" onClick={()=>void load()}><RefreshCw size={14}/> Reintentar</button>}</div>}
      <form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Tu pregunta para Financy</label><textarea ref={input} id="chat-message" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={keydown} maxLength={4000} rows={2} disabled={busy||!configured||loading} placeholder="¿Qué te gustaría entender de tus finanzas?"/><button type="submit" aria-label={error?'Reintentar mensaje':'Enviar mensaje'} disabled={busy||loading||!draft.trim()||!configured}><Send size={19}/></button></form>
      <div className="chat-footer">Puede proponer acciones; nada se aplica sin tu confirmación. La consulta y los datos relevantes se envían a Gemini.<br/>Memoria privada de tu cuenta. Puedes borrarla cuando quieras.</div>
    </dialog>
  </>;
}
