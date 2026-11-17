import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateLibraryBookDto, CreateLibraryLoanDto, ListLibraryBooksDto, ListLibraryLoansDto, UpdateLibraryBookDto } from './library.dto';

const loanInclude = {
  book: { select: { id: true, title: true, author: true, isbn: true } },
  student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
} satisfies Prisma.LibraryLoanInclude;

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  listBooks(query: ListLibraryBooksDto) {
    const search = query.search?.trim();
    return this.prisma.libraryBook.findMany({
      where: search ? { OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ] } : {},
      orderBy: [{ isActive: 'desc' }, { title: 'asc' }],
    });
  }

  async createBook(dto: CreateLibraryBookDto) {
    const copies = dto.totalCopies ?? 1;
    const book = await this.prisma.libraryBook.create({
      data: {
        title: dto.title.trim(),
        author: dto.author?.trim() || null,
        isbn: dto.isbn?.trim() || null,
        category: dto.category?.trim() || null,
        totalCopies: copies,
        availableCopies: copies,
      },
    });
    await this.audit('LIBRARY_BOOK_CREATED', book.id, { title: book.title, totalCopies: copies });
    return book;
  }

  async updateBook(id: string, dto: UpdateLibraryBookDto) {
    const existing = await this.prisma.libraryBook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ouvrage introuvable.');
    const activeLoans = await this.prisma.libraryLoan.count({ where: { bookId: id, returnedAt: null } });
    if (dto.totalCopies !== undefined && dto.totalCopies < activeLoans) {
      throw new BadRequestException('Le stock ne peut pas être inférieur au nombre d’exemplaires empruntés.');
    }
    if (dto.isActive === false && activeLoans > 0) {
      throw new BadRequestException('Retournez les exemplaires empruntés avant d’archiver cet ouvrage.');
    }
    const totalCopies = dto.totalCopies ?? existing.totalCopies;
    const availableCopies = existing.availableCopies + totalCopies - existing.totalCopies;
    if (availableCopies < 0) throw new BadRequestException('Le stock disponible ne peut pas être négatif.');
    const book = await this.prisma.libraryBook.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.author !== undefined ? { author: dto.author?.trim() || null } : {}),
        ...(dto.isbn !== undefined ? { isbn: dto.isbn?.trim() || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(dto.totalCopies !== undefined ? { totalCopies, availableCopies } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit('LIBRARY_BOOK_UPDATED', id, { changedFields: Object.keys(dto) });
    return book;
  }

  listLoans(query: ListLibraryLoansDto) {
    return this.prisma.libraryLoan.findMany({
      where: query.status === 'BORROWED' ? { returnedAt: null } : query.status === 'RETURNED' ? { returnedAt: { not: null } } : {},
      include: loanInclude,
      orderBy: query.status === 'RETURNED' ? { returnedAt: 'desc' } : { dueAt: 'asc' },
      take: 500,
    });
  }

  async createLoan(dto: CreateLibraryLoanDto) {
    const dueAt = new Date(`${dto.dueAt.slice(0, 10)}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (Number.isNaN(dueAt.getTime()) || dueAt < today) throw new BadRequestException('La date de retour prévue doit être aujourd’hui ou ultérieure.');

    return this.prisma.$transaction(async (transaction) => {
      const student = await transaction.student.findUnique({ where: { id: dto.studentId } });
      if (!student?.isActive) throw new BadRequestException('L’élève est introuvable ou archivé.');
      const stock = await transaction.libraryBook.updateMany({
        where: { id: dto.bookId, isActive: true, availableCopies: { gt: 0 } },
        data: { availableCopies: { decrement: 1 } },
      });
      if (stock.count !== 1) throw new BadRequestException('Ouvrage indisponible ou archivé.');
      const loan = await transaction.libraryLoan.create({
        data: { bookId: dto.bookId, studentId: dto.studentId, dueAt, note: dto.note?.trim() || null },
        include: loanInclude,
      });
      await transaction.auditLog.create({ data: { action: 'LIBRARY_LOAN_ISSUED', entityType: 'LibraryLoan', entityId: loan.id, details: { bookId: dto.bookId, studentId: dto.studentId, dueAt: dto.dueAt.slice(0, 10) } } });
      return loan;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async returnLoan(id: string) {
    return this.prisma.$transaction(async (transaction) => {
      const loan = await transaction.libraryLoan.findFirst({ where: { id, returnedAt: null } });
      if (!loan) {
        const existing = await transaction.libraryLoan.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Prêt introuvable.');
        throw new BadRequestException('Cet ouvrage a déjà été rendu.');
      }
      const updated = await transaction.libraryLoan.updateMany({ where: { id, returnedAt: null }, data: { returnedAt: new Date() } });
      if (updated.count !== 1) throw new BadRequestException('Ce prêt a déjà été clôturé.');
      await transaction.libraryBook.update({ where: { id: loan.bookId }, data: { availableCopies: { increment: 1 } } });
      const returnedLoan = await transaction.libraryLoan.findUniqueOrThrow({ where: { id }, include: loanInclude });
      await transaction.auditLog.create({ data: { action: 'LIBRARY_LOAN_RETURNED', entityType: 'LibraryLoan', entityId: id, details: { bookId: loan.bookId, studentId: loan.studentId } } });
      return returnedLoan;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private audit(action: string, entityId: string, details: Prisma.InputJsonObject) {
    return this.prisma.auditLog.create({ data: { action, entityType: 'LibraryBook', entityId, details } });
  }
}
