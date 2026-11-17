import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { OnlineEnrollmentRequest } from '@prisma/client';

type MailResult = 'sent' | 'not-configured' | 'failed';

@Injectable()
export class OnlineEnrollmentMailerService {
  private readonly logger = new Logger(OnlineEnrollmentMailerService.name);

  async notify(request: OnlineEnrollmentRequest, schoolName: string, className: string): Promise<MailResult> {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const from = process.env.SMTP_FROM?.trim();
    const to = process.env.ONLINE_ENROLLMENT_NOTIFICATION_EMAIL?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;

    if (!host || !from || !to || !Number.isInteger(port) || port < 1 || port > 65535 || Boolean(user) !== Boolean(pass)) {
      this.logger.warn('Enrollment email not sent: SMTP or recipient configuration is incomplete.');
      return 'not-configured';
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE?.toLowerCase() === 'true',
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character);
    const studentName = `${request.firstName} ${request.lastName}`;
    const guardianName = `${request.guardianFirstName} ${request.guardianLastName}`;
    const origin = (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');

    try {
      await transporter.sendMail({
        from,
        to,
        ...(request.guardianEmail ? { replyTo: request.guardianEmail } : {}),
        subject: `Nouvelle demande d’inscription – ${schoolName}`,
        text: [
          `Une nouvelle demande d’inscription a été reçue par ${schoolName}.`,
          `Élève : ${studentName}`,
          `Classe demandée : ${className}`,
          `Responsable : ${guardianName}`,
          `Téléphone : ${request.guardianPhone}`,
          `Référence : ${request.id}`,
          `Ouvrir ScolaPro : ${origin}`,
        ].join('\n'),
        html: `<p>Une nouvelle demande d’inscription a été reçue par <strong>${escapeHtml(schoolName)}</strong>.</p><ul><li>Élève : ${escapeHtml(studentName)}</li><li>Classe demandée : ${escapeHtml(className)}</li><li>Responsable : ${escapeHtml(guardianName)}</li><li>Téléphone : ${escapeHtml(request.guardianPhone)}</li></ul><p>Référence : <strong>${escapeHtml(request.id)}</strong></p><p><a href="${escapeHtml(origin)}">Ouvrir ScolaPro</a></p>`,
      });
      return 'sent';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMTP error';
      this.logger.error(`Enrollment email delivery failed: ${message}`);
      return 'failed';
    }
  }
}
