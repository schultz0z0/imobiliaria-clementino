import { z } from 'zod';

export const CONTRACT_STATUSES = ['active', 'expired', 'terminated'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const PAYMENT_CATEGORIES = [
  'rent',
  'condominium',
  'iptu',
  'water',
  'fire_insurance',
  'maintenance',
] as const;
export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORIES = [
  'contract_pdf',
  'inspection_report',
  'payment_receipt',
  'forwarding_receipt',
  'amendment',
  'other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const ADJUSTMENT_INDEXES = ['IGP-M', 'IPCA', 'INPC', 'IVAR', 'Outro'] as const;
export type AdjustmentIndex = (typeof ADJUSTMENT_INDEXES)[number];

export const IPTU_MODES = ['total', 'parcelado'] as const;
export type IptuMode = (typeof IPTU_MODES)[number];

export const validateAndFormatCpf = (raw: string): string | null => {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(digits)) return null;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]!, 10) * (10 - i);
  }
  let firstCheck = (sum * 10) % 11;
  if (firstCheck === 10) firstCheck = 0;
  if (firstCheck !== parseInt(digits[9]!, 10)) return null;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]!, 10) * (11 - i);
  }
  let secondCheck = (sum * 10) % 11;
  if (secondCheck === 10) secondCheck = 0;
  if (secondCheck !== parseInt(digits[10]!, 10)) return null;

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

const conciseText = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

const optionalConciseText = (maximum: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    conciseText(1, maximum).optional(),
  );

const optionalMoney = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.number().finite().nonnegative().optional(),
);

const optionalDate = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data deve ser AAAA-MM-DD').optional(),
);

const cpfSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z
    .string()
    .transform((val) => {
      const formatted = validateAndFormatCpf(val);
      if (!formatted) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: 'CPF inválido',
            path: [],
          },
        ]);
      }
      return formatted;
    })
    .optional(),
);

// 1. Schemas de Pessoas (Locadores e Locatarios)
export const createPersonSchema = z.strictObject({
  fullName: conciseText(2, 160),
  cpf: cpfSchema,
  birthDate: optionalDate,
  email: z.preprocess(
    (val) => (val === '' || val === null ? undefined : val),
    z.string().trim().email('E-mail inválido').optional(),
  ),
  phone: optionalConciseText(40),
  address: optionalConciseText(300),
  spouseName: optionalConciseText(160),
  spouseCpf: cpfSchema,
  spouseBirthDate: optionalDate,
  spouseAddress: optionalConciseText(300),
  spousePhone: optionalConciseText(40),
  notes: optionalConciseText(2000),
});

export const personSchema = createPersonSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// 2. Schemas de Contratos de Locacao
export const rentalContractBaseSchema = z
  .strictObject({
    contractNumber: conciseText(1, 80),
    propertyId: z.string().uuid(),
    landlordId: z.string().uuid(),
    tenantId: z.string().uuid(),
    status: z.enum(CONTRACT_STATUSES).default('active'),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de início obrigatória'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de término obrigatória'),
    adjustmentDate: optionalDate,
    adjustmentIndex: optionalConciseText(40),
    adjustmentPercentage: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.number().min(0).max(100).optional(),
    ),
    rentAmount: z.number().finite().nonnegative('Valor de aluguel deve ser positivo'),
    depositAmount: optionalMoney,
    condominiumAmount: optionalMoney,
    iptuAmount: optionalMoney,
    iptuNumber: optionalConciseText(80),
    iptuMode: z.enum(IPTU_MODES).default('total'),
    fireInsuranceAmount: optionalMoney,
    waterAmount: optionalMoney,
    maintenanceAmount: optionalMoney,
    rentDueDay: z.number().int().min(1, 'Dia deve ser entre 1 e 31').max(31, 'Dia deve ser entre 1 e 31'),
    waterDueDay: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.number().int().min(1).max(31).optional(),
    ),
    iptuDueDay: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.number().int().min(1).max(31).optional(),
    ),
    fireInsuranceDueDay: z.preprocess(
      (value) => (value === '' || value === null ? undefined : value),
      z.number().int().min(1).max(31).optional(),
    ),
    notes: optionalConciseText(2000),
  });

export const createRentalContractSchema = rentalContractBaseSchema.refine(
  (data) => data.endDate >= data.startDate,
  {
    message: 'Data de término deve ser posterior ou igual à data de início',
    path: ['endDate'],
  },
);

export const rentalContractSchema = rentalContractBaseSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// 3. Schemas de Pagamentos (Fluxo em 2 Etapas)
export const paymentRecordSchema = z.strictObject({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  category: z.enum(PAYMENT_CATEGORIES),
  referenceMonth: z.string(),
  amount: z.number().finite().nonnegative(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paidAt: z.string().datetime().optional().nullable(),
  paidReceiptId: z.string().uuid().optional().nullable(),
  forwardedAt: z.string().datetime().optional().nullable(),
  forwardedReceiptId: z.string().uuid().optional().nullable(),
  notes: optionalConciseText(2000),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const registerPaymentInputSchema = z.strictObject({
  paidAt: z.string().datetime(),
  paidReceiptId: z.string().uuid().optional(),
  notes: optionalConciseText(1000),
});

export const registerForwardingInputSchema = z.strictObject({
  forwardedAt: z.string().datetime(),
  forwardedReceiptId: z.string().uuid().optional(),
  notes: optionalConciseText(1000),
});

// 4. Schemas de Documentos
export const contractDocumentSchema = z.strictObject({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  category: z.enum(DOCUMENT_CATEGORIES),
  filename: conciseText(1, 255),
  storageKey: conciseText(1, 500),
  mimeType: conciseText(1, 120),
  byteSize: z.number().int().nonnegative(),
  description: optionalConciseText(500),
  checksumSha256: optionalConciseText(64),
  uploadedAt: z.string(),
});

// Tipos Inferidos TypeScript
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type PersonDto = z.infer<typeof personSchema>;

export type CreateRentalContractInput = z.infer<typeof createRentalContractSchema>;
export type RentalContractDto = z.infer<typeof rentalContractSchema>;

export type PaymentRecordDto = z.infer<typeof paymentRecordSchema>;
export type RegisterPaymentInput = z.infer<typeof registerPaymentInputSchema>;
export type RegisterForwardingInput = z.infer<typeof registerForwardingInputSchema>;

export type ContractDocumentDto = z.infer<typeof contractDocumentSchema>;
