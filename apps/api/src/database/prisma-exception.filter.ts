import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientRustPanicError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.SERVICE_UNAVAILABLE;
    let message = 'La base de données est indisponible. Vérifiez DATABASE_URL et PostgreSQL.';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Cette valeur existe déjà. Vérifiez les champs uniques.';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = 'La référence fournie ne correspond pas à un enregistrement valide.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'L’enregistrement demandé est introuvable.';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Une erreur est survenue lors de l’accès aux données.';
      }
    }

    response.status(status).json({ statusCode: status, message });
  }
}