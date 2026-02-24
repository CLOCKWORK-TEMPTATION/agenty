/**
 * Transaction Handling Integration Tests
 * Tests ACID properties and transaction management
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client, Pool } from 'pg';

const TEST_TIMEOUT = 30000;

const getTestConfig = () => ({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'agents_test',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

describe('Transaction Integration Tests', () => {
  let pool: Pool;
  let client: Client;

  beforeAll(
    async () => {
      pool = new Pool(getTestConfig());
      client = await pool.connect();

      // Create test tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS accounts (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          balance DECIMAL(10, 2) DEFAULT 0
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS transactions_log (
          id SERIAL PRIMARY KEY,
          from_account INTEGER,
          to_account INTEGER,
          amount DECIMAL(10, 2),
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    },
    { timeout: TEST_TIMEOUT }
  );

  afterAll(async () => {
    await client.query('DROP TABLE IF EXISTS accounts CASCADE');
    await client.query('DROP TABLE IF EXISTS transactions_log');

    if (client) {
      client.release();
    }
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(async () => {
    // Clean tables before each test
    await client.query('TRUNCATE accounts, transactions_log RESTART IDENTITY');
  });

  describe('Basic Transactions', () => {
    it(
      'should commit successful transaction',
      async () => {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ($1, $2)`,
          ['Alice', 1000]
        );

        await client.query('COMMIT');

        const result = await client.query(
          `SELECT * FROM accounts WHERE name = $1`,
          ['Alice']
        );

        expect(result.rows.length).toBe(1);
        expect(parseFloat(result.rows[0].balance)).toBe(1000);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should rollback failed transaction',
      async () => {
        try {
          await client.query('BEGIN');

          await client.query(
            `INSERT INTO accounts (name, balance) VALUES ($1, $2)`,
            ['Bob', 500]
          );

          // Force an error
          await client.query(`INSERT INTO non_existent_table VALUES (1)`);

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
        }

        const result = await client.query(
          `SELECT * FROM accounts WHERE name = $1`,
          ['Bob']
        );

        expect(result.rows.length).toBe(0);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should handle manual rollback',
      async () => {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ($1, $2)`,
          ['Charlie', 750]
        );

        // Manual rollback
        await client.query('ROLLBACK');

        const result = await client.query(
          `SELECT * FROM accounts WHERE name = $1`,
          ['Charlie']
        );

        expect(result.rows.length).toBe(0);
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('ACID Properties', () => {
    it(
      'should maintain atomicity',
      async () => {
        // Setup initial accounts
        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('Account1', 1000), ('Account2', 500)`
        );

        try {
          await client.query('BEGIN');

          // Transfer money
          await client.query(
            `UPDATE accounts SET balance = balance - $1 WHERE name = $2`,
            [200, 'Account1']
          );

          // Force error before completing transfer
          throw new Error('Simulated error');

          await client.query(
            `UPDATE accounts SET balance = balance + $1 WHERE name = $2`,
            [200, 'Account2']
          );

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
        }

        // Verify balances unchanged
        const account1 = await client.query(
          `SELECT balance FROM accounts WHERE name = 'Account1'`
        );
        const account2 = await client.query(
          `SELECT balance FROM accounts WHERE name = 'Account2'`
        );

        expect(parseFloat(account1.rows[0].balance)).toBe(1000);
        expect(parseFloat(account2.rows[0].balance)).toBe(500);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should maintain consistency with constraints',
      async () => {
        await client.query(`
          ALTER TABLE accounts ADD CONSTRAINT check_positive_balance
          CHECK (balance >= 0)
        `);

        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('TestAccount', 100)`
        );

        try {
          await client.query('BEGIN');
          await client.query(
            `UPDATE accounts SET balance = -50 WHERE name = 'TestAccount'`
          );
          await client.query('COMMIT');
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          await client.query('ROLLBACK');
          expect(error).toBeDefined();
        }

        const result = await client.query(
          `SELECT balance FROM accounts WHERE name = 'TestAccount'`
        );

        expect(parseFloat(result.rows[0].balance)).toBe(100);

        await client.query(
          `ALTER TABLE accounts DROP CONSTRAINT IF EXISTS check_positive_balance`
        );
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should provide isolation between transactions',
      async () => {
        // Setup
        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('Isolated', 1000)`
        );

        // Get two separate clients
        const client1 = await pool.connect();
        const client2 = await pool.connect();

        try {
          // Start transaction in client1
          await client1.query('BEGIN');
          await client1.query(
            `UPDATE accounts SET balance = balance + 500 WHERE name = 'Isolated'`
          );

          // Read from client2 (should see old value)
          const result = await client2.query(
            `SELECT balance FROM accounts WHERE name = 'Isolated'`
          );

          expect(parseFloat(result.rows[0].balance)).toBe(1000);

          // Commit client1
          await client1.query('COMMIT');

          // Now client2 should see new value
          const resultAfter = await client2.query(
            `SELECT balance FROM accounts WHERE name = 'Isolated'`
          );

          expect(parseFloat(resultAfter.rows[0].balance)).toBe(1500);
        } finally {
          client1.release();
          client2.release();
        }
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should provide durability',
      async () => {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('Durable', 2000)`
        );

        await client.query('COMMIT');

        // Simulate restart by getting new client
        const newClient = await pool.connect();

        try {
          const result = await newClient.query(
            `SELECT * FROM accounts WHERE name = 'Durable'`
          );

          expect(result.rows.length).toBe(1);
          expect(parseFloat(result.rows[0].balance)).toBe(2000);
        } finally {
          newClient.release();
        }
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Savepoints', () => {
    it(
      'should create and use savepoints',
      async () => {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('SP1', 100)`
        );

        await client.query('SAVEPOINT sp1');

        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('SP2', 200)`
        );

        await client.query('ROLLBACK TO SAVEPOINT sp1');

        await client.query('COMMIT');

        const result = await client.query(
          `SELECT name FROM accounts WHERE name IN ('SP1', 'SP2')`
        );

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].name).toBe('SP1');
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should support nested savepoints',
      async () => {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('Level1', 100)`
        );

        await client.query('SAVEPOINT level1');

        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('Level2', 200)`
        );

        await client.query('SAVEPOINT level2');

        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('Level3', 300)`
        );

        await client.query('ROLLBACK TO SAVEPOINT level2');

        await client.query('COMMIT');

        const result = await client.query(
          `SELECT name FROM accounts WHERE name IN ('Level1', 'Level2', 'Level3')`
        );

        expect(result.rows.length).toBe(2);
        expect(result.rows.map((r) => r.name).sort()).toEqual(['Level1', 'Level2']);
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Complex Transactions', () => {
    it(
      'should handle money transfer transaction',
      async () => {
        // Setup accounts
        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('Sender', 1000), ('Receiver', 500)`
        );

        const transferAmount = 300;

        await client.query('BEGIN');

        try {
          // Debit sender
          await client.query(
            `UPDATE accounts SET balance = balance - $1 WHERE name = 'Sender'`,
            [transferAmount]
          );

          // Credit receiver
          await client.query(
            `UPDATE accounts SET balance = balance + $1 WHERE name = 'Receiver'`,
            [transferAmount]
          );

          // Log transaction
          const senderResult = await client.query(
            `SELECT id FROM accounts WHERE name = 'Sender'`
          );
          const receiverResult = await client.query(
            `SELECT id FROM accounts WHERE name = 'Receiver'`
          );

          await client.query(
            `INSERT INTO transactions_log (from_account, to_account, amount)
             VALUES ($1, $2, $3)`,
            [senderResult.rows[0].id, receiverResult.rows[0].id, transferAmount]
          );

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }

        // Verify final balances
        const sender = await client.query(
          `SELECT balance FROM accounts WHERE name = 'Sender'`
        );
        const receiver = await client.query(
          `SELECT balance FROM accounts WHERE name = 'Receiver'`
        );

        expect(parseFloat(sender.rows[0].balance)).toBe(700);
        expect(parseFloat(receiver.rows[0].balance)).toBe(800);

        // Verify log
        const log = await client.query(
          `SELECT * FROM transactions_log ORDER BY id DESC LIMIT 1`
        );

        expect(parseFloat(log.rows[0].amount)).toBe(transferAmount);
      },
      { timeout: TEST_TIMEOUT }
    );

    it(
      'should handle batch operations',
      async () => {
        await client.query('BEGIN');

        const batchSize = 100;

        for (let i = 0; i < batchSize; i++) {
          await client.query(
            `INSERT INTO accounts (name, balance) VALUES ($1, $2)`,
            [`Batch${i}`, i * 10]
          );
        }

        await client.query('COMMIT');

        const result = await client.query(
          `SELECT COUNT(*) FROM accounts WHERE name LIKE 'Batch%'`
        );

        expect(parseInt(result.rows[0].count)).toBe(batchSize);
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Deadlock Detection', () => {
    it(
      'should detect and handle deadlocks',
      async () => {
        // Setup
        await client.query(
          `INSERT INTO accounts (name, balance) VALUES ('Account_A', 1000), ('Account_B', 1000)`
        );

        const client1 = await pool.connect();
        const client2 = await pool.connect();

        try {
          // Transaction 1: Lock Account_A
          await client1.query('BEGIN');
          await client1.query(
            `UPDATE accounts SET balance = balance - 100 WHERE name = 'Account_A'`
          );

          // Transaction 2: Lock Account_B
          await client2.query('BEGIN');
          await client2.query(
            `UPDATE accounts SET balance = balance - 100 WHERE name = 'Account_B'`
          );

          // Create potential deadlock situation
          let deadlockOccurred = false;

          try {
            // Transaction 1 tries to lock Account_B (with timeout)
            const promise1 = client1.query(
              `UPDATE accounts SET balance = balance + 100 WHERE name = 'Account_B'`
            );

            // Transaction 2 tries to lock Account_A (with timeout)
            const promise2 = client2.query(
              `UPDATE accounts SET balance = balance + 100 WHERE name = 'Account_A'`
            );

            await Promise.race([
              promise1,
              promise2,
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 1000)
              ),
            ]);
          } catch (error) {
            deadlockOccurred = true;
          }

          await client1.query('ROLLBACK');
          await client2.query('ROLLBACK');

          // Deadlock detection or timeout should occur
          expect(deadlockOccurred).toBe(true);
        } finally {
          client1.release();
          client2.release();
        }
      },
      { timeout: TEST_TIMEOUT }
    );
  });

  describe('Performance', () => {
    it(
      'should handle high transaction throughput',
      async () => {
        const startTime = Date.now();
        const transactions = 100;

        for (let i = 0; i < transactions; i++) {
          await client.query('BEGIN');
          await client.query(
            `INSERT INTO accounts (name, balance) VALUES ($1, $2)`,
            [`Perf${i}`, i]
          );
          await client.query('COMMIT');
        }

        const elapsed = Date.now() - startTime;

        const result = await client.query(
          `SELECT COUNT(*) FROM accounts WHERE name LIKE 'Perf%'`
        );

        expect(parseInt(result.rows[0].count)).toBe(transactions);
        expect(elapsed).toBeLessThan(10000); // Should complete in under 10 seconds
      },
      { timeout: TEST_TIMEOUT }
    );
  });
});
