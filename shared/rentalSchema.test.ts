import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPersonSchema,
  createRentalContractSchema,
  paymentRecordSchema,
  validateAndFormatCpf,
  CONTRACT_STATUSES,
  PAYMENT_CATEGORIES,
  DOCUMENT_CATEGORIES,
  ADJUSTMENT_INDEXES,
} from './rentalSchema.ts';

test('validateAndFormatCpf formats valid CPFs and rejects invalid CPFs', () => {
  // Valid CPFs (algorithmically valid with check digits)
  assert.equal(validateAndFormatCpf('52998224725'), '529.982.247-25');
  assert.equal(validateAndFormatCpf('529.982.247-25'), '529.982.247-25');

  // Invalid lengths or characters
  assert.equal(validateAndFormatCpf('123'), null);
  assert.equal(validateAndFormatCpf(''), null);
  assert.equal(validateAndFormatCpf('abcdefghijk'), null);

  // Repeated identical digits (invalid by Brazilian CPF algorithm)
  assert.equal(validateAndFormatCpf('111.111.111-11'), null);
  assert.equal(validateAndFormatCpf('00000000000'), null);

  // Invalid checksum digits
  assert.equal(validateAndFormatCpf('529.982.247-26'), null);
});

test('createPersonSchema validates correct person data and normalizes optional fields', () => {
  const validPerson = {
    fullName: 'Carlos Alberto da Silva',
    cpf: '529.982.247-25',
    birthDate: '1980-05-12',
    email: 'carlos.silva@exemplo.com.br',
    phone: '(11) 98765-4321',
    address: 'Rua das Flores, 123, São Paulo - SP',
    spouseName: 'Mariana da Silva',
    spouseCpf: '529.982.247-25',
  };

  const parsed = createPersonSchema.parse(validPerson);
  assert.equal(parsed.fullName, 'Carlos Alberto da Silva');
  assert.equal(parsed.cpf, '529.982.247-25');
  assert.equal(parsed.spouseName, 'Mariana da Silva');

  // Rejects invalid CPF in person or spouse
  assert.throws(() => {
    createPersonSchema.parse({
      fullName: 'Invalido',
      cpf: '123.456.789-00',
    });
  });

  // Rejects empty fullName
  assert.throws(() => {
    createPersonSchema.parse({
      fullName: '   ',
    });
  });
});

test('createRentalContractSchema validates dates, amounts, due days and indices', () => {
  const validContract = {
    contractNumber: 'LOC-2026-001',
    propertyId: '11111111-1111-4111-8111-111111111111',
    landlordId: '22222222-2222-4222-8222-222222222222',
    tenantId: '33333333-3333-4333-8333-333333333333',
    status: 'active',
    startDate: '2026-09-01',
    endDate: '2028-08-31',
    adjustmentDate: '2027-09-01',
    adjustmentIndex: 'IGP-M',
    adjustmentPercentage: 3.85,
    rentAmount: 2500,
    depositAmount: 7500,
    condominiumAmount: 450,
    iptuAmount: 180.5,
    iptuNumber: '123.456.789-0',
    iptuMode: 'parcelado',
    fireInsuranceAmount: 35,
    waterAmount: 80,
    maintenanceAmount: 0,
    rentDueDay: 10,
    waterDueDay: 15,
    iptuDueDay: 20,
    fireInsuranceDueDay: 10,
  };

  const parsed = createRentalContractSchema.parse(validContract);
  assert.equal(parsed.contractNumber, 'LOC-2026-001');
  assert.equal(parsed.rentAmount, 2500);
  assert.equal(parsed.rentDueDay, 10);
  assert.equal(parsed.adjustmentIndex, 'IGP-M');

  // Rejects endDate before startDate
  assert.throws(() => {
    createRentalContractSchema.parse({
      ...validContract,
      startDate: '2028-09-01',
      endDate: '2026-09-01',
    });
  });

  // Rejects rentDueDay outside 1..31
  assert.throws(() => {
    createRentalContractSchema.parse({
      ...validContract,
      rentDueDay: 32,
    });
  });
  assert.throws(() => {
    createRentalContractSchema.parse({
      ...validContract,
      rentDueDay: 0,
    });
  });

  // Rejects negative monetary amounts
  assert.throws(() => {
    createRentalContractSchema.parse({
      ...validContract,
      rentAmount: -100,
    });
  });
});

test('paymentRecordSchema validates financial categories and receipt links', () => {
  const payment = {
    id: '44444444-4444-4444-8444-444444444444',
    contractId: '55555555-5555-4555-8555-555555555555',
    category: 'rent',
    referenceMonth: '2026-09-01',
    amount: 2500,
    dueDate: '2026-09-10',
    paidAt: '2026-09-08T14:30:00Z',
    paidReceiptId: '66666666-6666-4666-8666-666666666666',
    forwardedAt: '2026-09-09T10:00:00Z',
    forwardedReceiptId: '77777777-7777-4777-8777-777777777777',
    notes: 'Pagamento efetuado pontualmente com repasse efetuado via TED',
  };

  const parsed = paymentRecordSchema.parse(payment);
  assert.equal(parsed.category, 'rent');
  assert.equal(parsed.amount, 2500);
  assert.ok(parsed.paidReceiptId);
  assert.ok(parsed.forwardedReceiptId);
});

test('constants export expected approved catalogs', () => {
  assert.ok(CONTRACT_STATUSES.includes('active'));
  assert.ok(CONTRACT_STATUSES.includes('expired'));
  assert.ok(CONTRACT_STATUSES.includes('terminated'));

  assert.ok(PAYMENT_CATEGORIES.includes('rent'));
  assert.ok(PAYMENT_CATEGORIES.includes('iptu'));
  assert.ok(PAYMENT_CATEGORIES.includes('fire_insurance'));

  assert.ok(DOCUMENT_CATEGORIES.includes('contract_pdf'));
  assert.ok(DOCUMENT_CATEGORIES.includes('payment_receipt'));
  assert.ok(DOCUMENT_CATEGORIES.includes('forwarding_receipt'));

  assert.ok(ADJUSTMENT_INDEXES.includes('IGP-M'));
  assert.ok(ADJUSTMENT_INDEXES.includes('IPCA'));
});
