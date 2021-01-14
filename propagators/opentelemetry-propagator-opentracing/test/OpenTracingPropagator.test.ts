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

import {
  defaultTextMapGetter,
  defaultTextMapSetter,
  INVALID_SPANID,
  INVALID_TRACEID,
  getParentSpanContext,
  setExtractedSpanContext,
  SpanContext,
  TraceFlags,
  Baggage,
  setBaggage,
  getBaggage,
} from '@opentelemetry/api';
import { ROOT_CONTEXT } from '@opentelemetry/context-base';
import * as assert from 'assert';
import {
  OpenTracingPropagator,
  OT_TRACE_ID_HEADER,
  OT_SPAN_ID_HEADER,
  OT_SAMPLED_HEADER,
  OT_BAGGAGE_PREFIX,
} from '../src/OpenTracingPropagator';

describe('OpenTracingPropagator', () => {
  const propagator = new OpenTracingPropagator();
  let carrier: { [key: string]: unknown };

  beforeEach(() => {
    carrier = {};
  });

  describe('.inject()', () => {
    it('injects context with sampled trace flags', () => {
      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.SAMPLED,
      };

      propagator.inject(
        setExtractedSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );

      assert.strictEqual(
        carrier[OT_TRACE_ID_HEADER],
        '80f198ee56343ba864fe8b2a57d3eff7'
      );
      assert.strictEqual(carrier[OT_SPAN_ID_HEADER], 'e457b5a2e4d86bd1');
      assert.strictEqual(carrier[OT_SAMPLED_HEADER], 'true');
    });

    it('injects context with unspecified trace flags', () => {
      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.NONE,
      };

      propagator.inject(
        setExtractedSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );

      assert.strictEqual(
        carrier[OT_TRACE_ID_HEADER],
        '80f198ee56343ba864fe8b2a57d3eff7'
      );
      assert.strictEqual(carrier[OT_SPAN_ID_HEADER], 'e457b5a2e4d86bd1');
      assert.strictEqual(carrier[OT_SAMPLED_HEADER], 'false');
    });

    it('no-ops if traceid invalid', () => {
      const spanContext: SpanContext = {
        traceId: INVALID_TRACEID,
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.SAMPLED,
      };

      propagator.inject(
        setExtractedSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );

      assert.strictEqual(carrier[OT_TRACE_ID_HEADER], undefined);
      assert.strictEqual(carrier[OT_SPAN_ID_HEADER], undefined);
      assert.strictEqual(carrier[OT_SAMPLED_HEADER], undefined);
    });

    it('no-ops if spanid invalid', () => {
      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: INVALID_SPANID,
        traceFlags: TraceFlags.SAMPLED,
      };

      propagator.inject(
        setExtractedSpanContext(ROOT_CONTEXT, spanContext),
        carrier,
        defaultTextMapSetter
      );

      assert.strictEqual(carrier[OT_TRACE_ID_HEADER], undefined);
      assert.strictEqual(carrier[OT_SPAN_ID_HEADER], undefined);
      assert.strictEqual(carrier[OT_SAMPLED_HEADER], undefined);
    });

    it('injects baggage', () => {
      const spanContext: SpanContext = {
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        spanId: 'e457b5a2e4d86bd1',
        traceFlags: TraceFlags.SAMPLED,
      };

      let context = setExtractedSpanContext(ROOT_CONTEXT, spanContext);

      const baggage: Baggage = {
        foo: { value: 'bar' },
        bar: { value: 'baz' },
      };

      context = setBaggage(context, baggage);

      propagator.inject(context, carrier, defaultTextMapSetter);

      assert.strictEqual(carrier[`${OT_BAGGAGE_PREFIX}foo`], 'bar');
      assert.strictEqual(carrier[`${OT_BAGGAGE_PREFIX}bar`], 'baz');
    });
  });

  describe('.extract', () => {
    it('extracts context with traceid, spanid, sampled true', () => {
      carrier = {
        [OT_TRACE_ID_HEADER]: '80f198ee56343ba864fe8b2a57d3eff7',
        [OT_SPAN_ID_HEADER]: 'e457b5a2e4d86bd1',
        [OT_SAMPLED_HEADER]: 'true',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = getParentSpanContext(context);

      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'e457b5a2e4d86bd1',
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        isRemote: true,
        traceFlags: TraceFlags.SAMPLED,
      });
    });

    it('extracts context with traceid, spanid, sampled false', () => {
      carrier = {
        [OT_TRACE_ID_HEADER]: '80f198ee56343ba864fe8b2a57d3eff7',
        [OT_SPAN_ID_HEADER]: 'e457b5a2e4d86bd1',
        [OT_SAMPLED_HEADER]: 'false',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = getParentSpanContext(context);

      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'e457b5a2e4d86bd1',
        traceId: '80f198ee56343ba864fe8b2a57d3eff7',
        isRemote: true,
        traceFlags: TraceFlags.NONE,
      });
    });

    it('converts 8-byte traceid', () => {
      carrier = {
        [OT_TRACE_ID_HEADER]: '4aaba1a52cf8ee09',
        [OT_SPAN_ID_HEADER]: 'e457b5a2e4d86bd1',
        [OT_SAMPLED_HEADER]: 'false',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = getParentSpanContext(context);
      assert.deepStrictEqual(extractedSpanContext, {
        spanId: 'e457b5a2e4d86bd1',
        traceId: '00000000000000004aaba1a52cf8ee09',
        isRemote: true,
        traceFlags: TraceFlags.NONE,
      });
    });

    it('handles malformed traceid', () => {
      carrier = {
        [OT_TRACE_ID_HEADER]: 'abc123',
        [OT_SPAN_ID_HEADER]: 'e457b5a2e4d86bd1',
        [OT_SAMPLED_HEADER]: 'false',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = getParentSpanContext(context);
      assert.deepStrictEqual(undefined, extractedSpanContext);
    });

    it('handles malformed spanid', () => {
      carrier = {
        [OT_TRACE_ID_HEADER]: '0f198ee56343ba864fe8b2a57d3eff7',
        [OT_SPAN_ID_HEADER]: 'abc123',
        [OT_SAMPLED_HEADER]: 'false',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = getParentSpanContext(context);
      assert.deepStrictEqual(undefined, extractedSpanContext);
    });

    it('handles invalid traceid', () => {
      carrier = {
        [OT_TRACE_ID_HEADER]: INVALID_TRACEID,
        [OT_SPAN_ID_HEADER]: 'e457b5a2e4d86bd1',
        [OT_SAMPLED_HEADER]: 'false',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const extractedSpanContext = getParentSpanContext(context);
      assert.deepStrictEqual(undefined, extractedSpanContext);
    });

    it('extracts baggage', () => {
      carrier = {
        [OT_TRACE_ID_HEADER]: '80f198ee56343ba864fe8b2a57d3eff7',
        [OT_SPAN_ID_HEADER]: 'e457b5a2e4d86bd1',
        [OT_SAMPLED_HEADER]: 'false',
        [`${OT_BAGGAGE_PREFIX}foo`]: 'bar',
        [`${OT_BAGGAGE_PREFIX}bar`]: 'baz',
      };

      const context = propagator.extract(
        ROOT_CONTEXT,
        carrier,
        defaultTextMapGetter
      );

      const baggage = getBaggage(context);

      assert.ok(baggage);
      assert.deepStrictEqual(baggage, {
        foo: { value: 'bar' },
        bar: { value: 'baz' },
      });
    });
  });
});
