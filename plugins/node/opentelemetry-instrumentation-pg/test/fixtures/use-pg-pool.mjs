/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Use pg-pool from an ES module:
//    node --experimental-loader=@opentelemetry/instrumentation/hook.mjs use-pg-pool.mjs

import { trace } from '@opentelemetry/api';
import { createTestNodeSdk } from '@opentelemetry/contrib-test-utils';
import assert from 'assert';

import { PgInstrumentation } from '../../build/src/index.js';

const CONFIG = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'otel_pg_database',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT
    ? parseInt(process.env.POSTGRES_PORT, 10)
    : 54320,
};

const sdk = createTestNodeSdk({
  serviceName: 'use-pg-pool',
  instrumentations: [new PgInstrumentation()],
});
sdk.start();

import Pool from 'pg-pool';
const pgPool = new Pool(CONFIG);

const tracer = trace.getTracer();

await tracer.startActiveSpan('test-span', async span => {
  const client = await pgPool.connect();
  try {
    const res = await pgPool.query('SELECT NOW()');
    assert.ok(res);
    console.log('rows:', res.rows);
  } finally {
    client.release();
    pgPool.end();
    span.end();
    sdk.shutdown();
  }
});
