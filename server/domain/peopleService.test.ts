import assert from 'node:assert/strict';
import test from 'node:test';
import { createPostgresClient } from '../db/client.ts';
import {
  createPerson,
  getPersonById,
  listPeople,
  updatePerson,
  deletePerson,
} from './peopleService.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

test('peopleService creates, retrieves, lists, updates and deletes people', async (t) => {
  if (!databaseUrl) {
    t.skip('TEST_DATABASE_URL not configured');
    return;
  }

  const sql = createPostgresClient(databaseUrl, { max: 1 });
  try {
    await sql`DELETE FROM rental_contracts WHERE contract_number LIKE 'CTR-%'`;
    await sql`DELETE FROM people WHERE cpf = '529.982.247-25' OR full_name LIKE '%Locador%' OR full_name LIKE '%Inquilino%'`;

    // 1. Create person
    const created = await createPerson(sql, {
      fullName: 'João da Silva Locador',
      cpf: '529.982.247-25',
      birthDate: '1975-03-20',
      email: 'joao.locador@teste.com.br',
      phone: '(11) 99999-1111',
      address: 'Rua dos Proprietários, 100',
    });

    assert.ok(created.id);
    assert.equal(created.fullName, 'João da Silva Locador');
    assert.equal(created.cpf, '529.982.247-25');

    // 2. Get by ID
    const fetched = await getPersonById(sql, created.id);
    assert.ok(fetched);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.email, 'joao.locador@teste.com.br');

    // 3. Prevent duplicate CPF
    await assert.rejects(async () => {
      await createPerson(sql, {
        fullName: 'Outro João',
        cpf: '529.982.247-25',
      });
    });

    // 4. Update person
    const updated = await updatePerson(sql, created.id, {
      fullName: 'João da Silva Locador Atualizado',
      phone: '(11) 98888-2222',
    });
    assert.equal(updated.fullName, 'João da Silva Locador Atualizado');
    assert.equal(updated.phone, '(11) 98888-2222');

    // 5. List people with search
    const list = await listPeople(sql, { search: 'Locador Atualizado', page: 1, limit: 10 });
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0]?.id, created.id);
    assert.equal(list.pagination.total, 1);

    // 6. Delete person
    await deletePerson(sql, created.id);
    const afterDelete = await getPersonById(sql, created.id);
    assert.equal(afterDelete, null);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
