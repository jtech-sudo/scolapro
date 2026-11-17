import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CancelExpenseDto,
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  ListExpensesDto,
  UpdateExpenseCategoryDto,
} from './finance.dto';
import { FinanceService } from './finance.service';

@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('expense-categories')
  listCategories() { return this.finance.listCategories(); }

  @Post('expense-categories')
  createCategory(@Body() dto: CreateExpenseCategoryDto) { return this.finance.createCategory(dto); }

  @Patch('expense-categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateExpenseCategoryDto) { return this.finance.updateCategory(id, dto); }

  @Get('expenses')
  listExpenses(@Query() query: ListExpensesDto) { return this.finance.listExpenses(query); }

  @Post('expenses')
  createExpense(@Body() dto: CreateExpenseDto) { return this.finance.createExpense(dto); }

  @Post('expenses/:id/cancel')
  cancelExpense(@Param('id') id: string, @Body() dto: CancelExpenseDto) { return this.finance.cancelExpense(id, dto); }

  @Get('finance/report')
  getReport(@Query() query: ListExpensesDto) { return this.finance.getReport(query); }

  @Get('finance/accounting')
  getAccounting(@Query() query: ListExpensesDto) { return this.finance.getAccountingSnapshot(query); }
}