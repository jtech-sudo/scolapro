import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CancelPaymentDto,
  CreateFeeTypeDto,
  CreateInstallmentDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  ListInvoicesDto,
  ListPaymentsDto,
  UpdateFeeTypeDto,
} from './billing.dto';
import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('fee-types')
  listFeeTypes() { return this.billing.listFeeTypes(); }

  @Post('fee-types')
  createFeeType(@Body() dto: CreateFeeTypeDto) { return this.billing.createFeeType(dto); }

  @Patch('fee-types/:id')
  updateFeeType(@Param('id') id: string, @Body() dto: UpdateFeeTypeDto) { return this.billing.updateFeeType(id, dto); }

  @Get('billing/summary')
  getSummary(@Query('schoolYearId') schoolYearId?: string) { return this.billing.getSummary(schoolYearId); }

  @Get('invoices')
  listInvoices(@Query() query: ListInvoicesDto) { return this.billing.listInvoices(query); }

  @Post('invoices')
  createInvoice(@Body() dto: CreateInvoiceDto) { return this.billing.createInvoice(dto); }

  @Post('invoices/:id/installments')
  addInstallment(@Param('id') id: string, @Body() dto: CreateInstallmentDto) { return this.billing.addInstallment(id, dto); }

  @Get('payments')
  listPayments(@Query() query: ListPaymentsDto) { return this.billing.listPayments(query); }

  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto) { return this.billing.createPayment(dto); }

  @Post('payments/:id/cancel')
  cancelPayment(@Param('id') id: string, @Body() dto: CancelPaymentDto) { return this.billing.cancelPayment(id, dto); }

  @Get('payments/:id/receipt')
  getReceipt(@Param('id') id: string) { return this.billing.getReceipt(id); }
}