import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { Database, Sql } from '../database';
import { now, parse, dueAt } from '../domain';
const resources=['earnings','expenses','shopping','budgets','splits','movements','allocations'] as const;
const querySchema=z.object({resource:z.enum(resources),from:z.iso.date().optional(),to:z.iso.date().optional(),q:z.string().max(120).optional(),page:z.number().int().min(1).max(10000).default(1),project_id:z.number().int().positive().optional(),recurring:z.boolean().optional()}).strict();
export const FINANCIAL_TOOL={name:'consultar_finanzas',description:'Consulta registros o totales históricos del usuario autenticado. Todas las páginas tienen totales completos sobre el filtro, nunca sumar solamente la página. Usa filtros de fecha y texto para preguntas específicas. Devuelve cobertura y páginas pendientes. Los proyectos se incluyen salvo que se indique project_id; separa sus importes de las cuentas personales.',parameters:{type:'OBJECT',properties:{resource:{type:'STRING',enum:[...resources]},from:{type:'STRING',description:'Fecha inicial YYYY-MM-DD'},to:{type:'STRING',description:'Fecha final YYYY-MM-DD'},q:{type:'STRING',description:'Texto en descripción o etiquetas'},page:{type:'INTEGER'},project_id:{type:'INTEGER'},recurring:{type:'BOOLEAN',description:'Solo ingresos/gastos: true plantillas recurrentes; false historial realizado; omitido ambos separados en totales'}},required:['resource']}};
@Injectable()
export class FinancialContextService {
  constructor(@Inject(Database) private db:Database){}
  async snapshot(user:string){
    return this.db.transaction(async sql=>{
      await sql.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const profile=(await sql.query('SELECT name,monthly_expense_limit FROM users WHERE id=$1',[user])).rows[0];
      const accounts:any={};for(const t of ['boxes','savings'])accounts[t]=(await sql.query(`SELECT id,amount FROM ${t} WHERE "user"=$1 ORDER BY id`,[user])).rows;
      const totals:any={};for(const t of ['earnings','expenses'])totals[t]=(await sql.query(`SELECT project_id,provider,${t==='earnings'?'currency':"'$'"} AS currency, (term IS NOT NULL OR claim_day IS NOT NULL) AS recurring,count(*) AS count,COALESCE(sum(amount),0) AS amount,min(created_at) AS first_date,max(created_at) AS last_date FROM ${t} WHERE "user"=$1 GROUP BY project_id,provider,${t==='earnings'?'currency,':''}(term IS NOT NULL OR claim_day IS NOT NULL) ORDER BY project_id NULLS FIRST LIMIT 101`,[user])).rows;
      const months=(await sql.query(`SELECT month,type,sum(amount) AS amount,count(*) AS count FROM (SELECT to_char(created_at,'YYYY-MM') AS month,'income' AS type,amount FROM earnings WHERE "user"=$1 AND project_id IS NULL AND term IS NULL AND claim_day IS NULL UNION ALL SELECT to_char(created_at,'YYYY-MM') AS month,'expense' AS type,amount FROM expenses WHERE "user"=$1 AND project_id IS NULL AND term IS NULL AND claim_day IS NULL) h GROUP BY month,type ORDER BY month DESC LIMIT 24`,[user])).rows;
      const shopping=(await sql.query('SELECT status,not_discount,count(*) AS count,COALESCE(sum(amount),0) AS amount FROM shop_list_items WHERE "user"=$1 GROUP BY status,not_discount',[user])).rows;
      const currentBudgets=await this.queryWith(sql,user,{resource:'budgets',from:now().startOf('month').toISODate()!,to:now().endOf('month').toISODate()!,page:1});
      return {as_of:now().toISO(),timezone:'America/Caracas',profile,accounts,all_time_totals:totals,totals_groups_truncated:Object.values(totals).some((v:any)=>v.length>100),recent_months:months,recent_months_limit:24,shopping,current_budgets:currentBudgets,notes:'Saldos actuales son la fuente de verdad. No se reconstruyen sumando historial: hay transferencias y saldos importados. Totales agrupados: máximo 101 grupos; usa herramientas para desgloses adicionales. Meses limitados a 24 grupos mes/tipo; no es todo el historial. Plantillas recurrentes no son movimientos realizados. No sumar distintas monedas. Datos personales y de proyectos separados.'};
    });
  }
  async query(user:string,args:unknown){const v=parse(querySchema,args);return this.db.transaction(async sql=>{await sql.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');return this.queryWith(sql,user,v);});}
  private async queryWith(sql:Sql,user:string,v:z.infer<typeof querySchema>){
    const params:any[]=[user];let source='',where='',columns='',date='',search='',group='';
    if(v.resource==='earnings'||v.resource==='expenses'){
      source=v.resource+' e';where='e."user"=$1';date='e.created_at';search="e.description || ' ' || COALESCE(e.slug,'')";
      columns=`e.id,e.description,e.amount,e.provider,e.project_id,e.slug,e.term,e.claim_day,e."UpdatedTerm",e."NextClaim",e.recurrence_type,e.auto_claim,e.recurring_id,e.created_at,${v.resource==='earnings'?'e.currency':"'$' AS currency,e.shop_list_item_id"}`;
      group=`e.project_id,e.provider,${v.resource==='earnings'?'e.currency':"'$'::text"},(e.term IS NOT NULL OR e.claim_day IS NOT NULL)`;
    }else if(v.resource==='shopping'){source='shop_list_items e';where='e."user"=$1';date='e.created_at';search='e.description';columns='e.id,e.description,e.amount,e.status,e.provider,e.not_discount,e.created_at';}
    else if(v.resource==='budgets'){source='budget_categories e JOIN monthly_budgets b ON b.id=e.monthly_budget_id';where='b.user_id=$1';date='b.month';search="e.name || ' ' || e.slug";columns='e.id,e.name,e.slug,e.amount,b.month';}
    else if(v.resource==='splits'){source='expense_splits e JOIN expenses x ON x.id=e.expense_id';where='x."user"=$1';date='e.created_at';search='x.description';columns='e.expense_id,e.amount,e.paid_amount,e.status,x.description,x.project_id';}
    else if(v.resource==='allocations'){source="financy_allocations e JOIN (SELECT id,'earnings' AS kind,\"user\",description,created_at FROM earnings UNION ALL SELECT id,'expenses' AS kind,\"user\",description,created_at FROM expenses) x ON x.id=e.reference_id AND x.kind=e.kind";where='x."user"=$1';date='x.created_at';search='x.description';columns='e.kind,e.reference_id,e.box,e.savings,x.description,x.created_at';}
    else{source='movements e';where='e."user"=$1';date='e.created_at';search='e.description';columns='e.id,e.type,e.description,e.amount,e.provider,e.project_id,e.reference_id,e.created_at';}
    const add=(condition:string,value:any)=>{params.push(value);where+=' AND '+condition.replace('?',`$${params.length}`);};
    if(v.from)add(`${date}>=?::date`,v.from);if(v.to)add(`${date}<?::date+interval '1 day'`,v.to);if(v.q)add(`lower(${search}) LIKE ?`,'%'+v.q.toLowerCase()+'%');
    if(v.project_id!==undefined){if(!['earnings','expenses','movements','splits'].includes(v.resource))return {error:'Este recurso no tiene proyectos'};add(`${v.resource==='splits'?'x':'e'}.project_id=?`,v.project_id);}
    if(v.recurring!==undefined){if(!['earnings','expenses'].includes(v.resource))return {error:'Solo ingresos y gastos tienen recurrencias'};where+=v.recurring?' AND (e.term IS NOT NULL OR e.claim_day IS NOT NULL)':' AND e.term IS NULL AND e.claim_day IS NULL';}
    const total=(await sql.query(`SELECT count(*) AS count ${v.resource==='allocations'?'':',COALESCE(sum(e.amount),0) AS amount'} FROM ${source} WHERE ${where}`,params)).rows[0];
    let totals:any=null;
    if(group)totals=(await sql.query(`SELECT e.project_id,e.provider,${v.resource==='earnings'?'e.currency':"'$'::text AS currency"},(e.term IS NOT NULL OR e.claim_day IS NOT NULL) AS recurring, sum(e.amount) AS amount,count(*) AS count FROM ${source} WHERE ${where} GROUP BY ${group} LIMIT 101`,params)).rows;
    const rows=(await sql.query(`SELECT ${columns} FROM ${source} WHERE ${where} ORDER BY ${date} DESC,e.${v.resource==='allocations'?'reference_id':'id'} DESC LIMIT 30 OFFSET $${params.length+1}`,[...params,(v.page-1)*30])).rows;
    return {as_of:now().toISO(),resource:v.resource,filter:v,total:Number(total.count),totals:totals??{amount:v.resource==='allocations'?null:total.amount},totals_groups_truncated:totals?.length>100,page:v.page,pages:Math.ceil(Number(total.count)/30),rows:rows.map(r=>({...r,...(group?{due_at:dueAt(r)?.toISO()??null}:{})})),notes:v.resource==='movements'?'Registro legado: puede incluir plantillas antiguas; para totales usa earnings/expenses recurrent=false.':v.resource==='budgets'?'amount es el límite de la categoría. Consulta gastos históricos del mes y etiquetas para calcular consumo; una misma etiqueta puede pertenecer a más de una categoría.':v.resource==='allocations'?'Solo movimientos creados por NestJS tienen distribución exacta.':''};
  }
}
