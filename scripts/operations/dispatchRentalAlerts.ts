import { closePostgresClient, createPostgresClient, getPostgresClient } from '../../server/db/client.ts';
import { dispatchAlerts } from '../../server/domain/rentalAlertService.ts';

const run = async () => {
  console.log('[dispatchRentalAlerts] Iniciando verificação e despacho de alertas operacionais...');

  const databaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
  const sql = databaseUrl ? createPostgresClient(databaseUrl) : getPostgresClient();
  const resendApiKey = process.env.RESEND_API_KEY;
  const recipientEmail =
    process.env.ALERT_RECIPIENT_EMAIL || 'locacoes@imobiliariaclementino.com.br';

  const senderEmail = process.env.ALERT_SENDER_EMAIL;

  if (!resendApiKey) {
    console.warn(
      '[dispatchRentalAlerts] AVISO: RESEND_API_KEY não informada. Executando em modo de registro sem envio HTTP externo.',
    );
  }

  try {
    const result = await dispatchAlerts(sql, {
      resendApiKey,
      recipientEmail,
      senderEmail,
      asOfDate: new Date(),
    });

    console.log('[dispatchRentalAlerts] Concluído com sucesso:');
    console.log(`  - Novos alertas disparados: ${result.dispatchedCount}`);
    console.log(`  - Alertas ignorados (já notificados): ${result.skippedCount}`);
    console.log(`  - E-mail enviado via Resend: ${result.emailSent ? 'SIM' : 'NÃO'}`);
    console.log(`  - Destinatário: ${recipientEmail}`);

    if (result.alerts.length > 0) {
      console.log('\nDetalhamento dos novos alertas:');
      for (const a of result.alerts) {
        console.log(`  * [${a.alertType}] Contrato ${a.contractNumber} (Ref: ${a.referenceDate})`);
      }
    }
  } catch (error) {
    console.error('[dispatchRentalAlerts] Erro ao processar alertas:', error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
    await closePostgresClient();
  }
};

void run();
