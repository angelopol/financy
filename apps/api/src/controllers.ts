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
  @Post('entries/:kind') create(
    @Req() r: AuthRequest,
    @Param('kind') k: string,
    @Body() b: unknown,
  ) {
    return this.f.save(r.user.id, kind(k), b);
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
  @Post('accounts/transfer') transfer(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.p.transfer(r.user.id, b);
  }
  @Get('shopping') shopping(@Req() r: AuthRequest) {
    return this.p.shopList(r.user.id);
  }
  @Post('shopping') shopCreate(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.p.shopSave(r.user.id, b);
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
  @Post('shopping/:id/:action') shopAction(
    @Req() r: AuthRequest,
    @Param('id') id: string,
    @Param('action') action: string,
    @Body() b: unknown,
  ) {
    return this.p.shopAction(r.user.id, parse(idSchema, id), action, b);
  }
  @Get('budgets') budgets(@Req() r: AuthRequest, @Query('month') month?: string) {
    return this.p.budgets(r.user.id, month ?? now().toFormat('yyyy-MM'));
  }
  @Post('budgets') budgetCreate(@Req() r: AuthRequest, @Body() b: unknown) {
    return this.p.budgetSave(r.user.id, b);
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
