import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateLibraryBookDto, CreateLibraryLoanDto, ListLibraryBooksDto, ListLibraryLoansDto, UpdateLibraryBookDto } from './library.dto';
import { LibraryService } from './library.service';

@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('books')
  listBooks(@Query() query: ListLibraryBooksDto) { return this.library.listBooks(query); }

  @Post('books')
  createBook(@Body() dto: CreateLibraryBookDto) { return this.library.createBook(dto); }

  @Patch('books/:id')
  updateBook(@Param('id') id: string, @Body() dto: UpdateLibraryBookDto) { return this.library.updateBook(id, dto); }

  @Get('loans')
  listLoans(@Query() query: ListLibraryLoansDto) { return this.library.listLoans(query); }

  @Post('loans')
  createLoan(@Body() dto: CreateLibraryLoanDto) { return this.library.createLoan(dto); }

  @Post('loans/:id/return')
  returnLoan(@Param('id') id: string) { return this.library.returnLoan(id); }
}
