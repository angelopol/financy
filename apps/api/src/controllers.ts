import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthGuard, AuthRequest } from './auth';
import { FinanceService } from './finance';
import { PlanningService } from './planning';
import { ActivityService } from './activity';
import { amountSchema, currencySchema, idSchema, kind, monthSchema, now, parse } from './domain';
export const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^\s*[=+@-]|^[\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
@Controller()
@UseGuards(AuthGuard)
export class FinanceController {
  constructor(
    @Inject(FinanceService) private f: FinanceService,
    @Inject(PlanningService) private p: PlanningService,
    @Inject(ActivityService) private activity: ActivityService,
  ) {}
  @Get('dashboard') dashboard(@Req() r: AuthRequest, @Query('month') m?: string) {
    return this.f.dashboard(r.user.id, parse(monthSchema, m ?? now().toFormat('yyyy-MM')));
  }
  @Get('rates') rates(@Query('date') date?: string) {
    return this.f.rates.get(date ? parse(z.iso.date(), date) : undefined);
  }
  @Post('calculator') async calculator(@Body() body: unknown) {
    const v = parse(
      z.object({ amount: amountSchema, currency: currencySchema, date: z.iso.date().optional() }),
      body,
    );
    return { amount: await this.f.rates.convert(v.currency, v.amount, v.date), currency: 'USD' };
  }
  @Get('entries/:kind') list(@Req() r: AuthRequest, @Param('kind') k: string, @Query() q: any) {
    return this.f.list(r.user.id, kind(k), q);
  }
  @Post('entries/:kind') async create(
    @Req() r: AuthRequest,
    @Param('kind') k: string,
    @Body() b: unknown,
  ) {
    const t = kind(k);
    const row = await this.f.save(r.user.id, t, b);
    await this.activity.log(
      r.user.id,
      'user',
      t === 'earnings' ? 'earning_created' : 'expense_created',
      row.id,
      `${t === 'earnings' ? 'Ingreso registrado' : 'Gasto registrado'}: "${row.description}" por ${row.amount} ${row.currency ?? '$'}`,
    );
    return row;
  }
  @Patch('entries/:kind/:id') update(
    @Req() r: AuthRequest,
    @Param('kind') k: string,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.f.save(r.user.id, kind(k), b, parse(idSchema, id));
  }
  @Delete('entries/:kind/:id') remove(
    @Req() r: AuthRequest,
    @Param('kind') k: string,
    @Param('id') id: string,
  ) {
    return this.f.remove(r.user.id, kind(k), parse(idSchema, id));
  }
  @Post('entries/:kind/:id/claim') claim(
    @Req() r: AuthRequest,
    @Param('kind') k: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const v = parse(z.object({ expected_anchor: z.string().max(100).optional() }), body);
    return this.f.claim(r.user.id, kind(k), parse(idSchema, id), v.expected_anchor);
  }
  @Post('entries/:kind/:id/resync') async resync(
    @Req() r: AuthRequest,
    @Param('kind') k: string,
    @Param('id') id: string,
  ) {
    const result = await this.f.resync(r.user.id, kind(k), parse(idSchema, id));
    await this.activity.log(
      r.user.id,
      'user',
      'schedule_resynced',
      id,
      `Fecha de recurrencia actualizada a hoy${k === 'earnings' ? ' (ingreso)' : ' (gasto)'}`,
    );
    return result;
  }
  @Get('reports/:kind') report(@Req() r: AuthRequest, @Param('kind') k: string, @Query() q: any) {
    return this.f.list(r.user.id, kind(k), q, true);
  }
  @Get('exports/:kind') async csv(
    @Req() r: AuthRequest,
    @Param('kind') k: string,
    @Query() q: any,
    @Res() res: Response,
  ) {
    kind(k);
    const first = await this.f.list(r.user.id, kind(k), { ...q, page: 1 }, true);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="financy-${k}.csv"`);
    res.write('\uFEFFid,descripcion,etiquetas,importe,cuenta,fecha\r\n');
    for (let page = 1; page <= Math.max(1, first.pages); page++) {
      const result =
        page === 1 ? first : await this.f.list(r.user.id, kind(k), { ...q, page }, true);
      for (const e of result.items)
        res.write(
          [
            e.id,
            e.description,
            e.slug,
            e.amount,
            e.provider,
            e.created_at instanceof Date ? e.created_at.toISOString() : e.created_at,
          ]
            .map(csvCell)
            .join(',') + '\r\n',
        );
    }
    res.end();
  }
  @Post('accounts/transfer') async transfer(@Req() r: AuthRequest, @Body() b: unknown) {
    const v = parse(z.object({ amount: amountSchema, from: z.enum(['box', 'savings']) }), b);
    const result = await this.p.transfer(r.user.id, v);
    await this.activity.log(
      r.user.id,
      'user',
      'transfer',
      null,
      `Transferencia de ${v.amount} de ${v.from === 'box' ? 'Caja' : 'Ahorros'} a ${v.from === 'box' ? 'Ahorros' : 'Caja'}`,
      v,
    );
    return result;
  }
  @Get('shopping') shopping(@Req() r: AuthRequest, @Query() q: any) {
    return this.p.shopList(r.user.id, q);
  }
  @Post('shopping') async shopCreate(@Req() r: AuthRequest, @Body() b: unknown) {
    const row = await this.p.shopSave(r.user.id, b);
    await this.activity.log(
      r.user.id,
      'user',
      'shopping_created',
      row.id,
      `Compra agregada a la lista: "${row.description}" por ${row.amount} $`,
    );
    return row;
  }
  @Patch('shopping/:id') shopUpdate(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.p.shopSave(r.user.id, b, parse(idSchema, id));
  }
  @Delete('shopping/:id') shopDelete(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.p.shopAction(r.user.id, parse(idSchema, id), 'delete', {});
  }
  @Post('shopping/:id/:action') async shopAction(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() b: unknown,
  ) {
    const result = await this.p.shopAction(r.user.id, parse(idSchema, id), action, b);
    if (action === 'deposit' || action === 'withdraw')
      await this.activity.log(
        r.user.id,
        'user',
        action === 'deposit' ? 'shop_saving_deposit' : 'shop_saving_withdraw',
        result.id,
        action === 'deposit'
          ? `Abono de ${result.amount} $ para "${result.description}"`
          : `Retiro de ${result.amount} $ del ahorro para "${result.description}"`,
      );
    return result;
  }
  @Get('budgets') budgets(@Req() r: AuthRequest, @Query('month') month?: string) {
    return this.p.budgets(r.user.id, month ?? now().toFormat('yyyy-MM'));
  }
  @Post('budgets') async budgetCreate(@Req() r: AuthRequest, @Body() b: unknown) {
    const row = await this.p.budgetSave(r.user.id, b);
    await this.activity.log(
      r.user.id,
      'user',
      'budget_created',
      row.id,
      `Presupuesto creado: "${row.name}" por ${row.amount}`,
    );
    return row;
  }
  @Patch('budgets/:id') budgetUpdate(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.p.budgetSave(r.user.id, b, parse(idSchema, id));
  }
  @Delete('budgets/:id') budgetDelete(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.p.budgetDelete(r.user.id, parse(idSchema, id));
  }
  @Get('expenses/:id/splits') splits(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.p.splits(r.user.id, parse(idSchema, id));
  }
  @Post('expenses/:id/splits') splitSave(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Body() b: unknown,
  ) {
    return this.p.splits(r.user.id, parse(idSchema, id), b);
  }
}
