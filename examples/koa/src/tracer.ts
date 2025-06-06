'use strict';

import { KoaInstrumentation } from '@opentelemetry/instrumentation-koa';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';

import * as api from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

const EXPORTER = process.env.EXPORTER || '';

export const setupTracing = (serviceName: string) => {
  let exporter;
  if (EXPORTER === 'jaeger') {
    exporter = new JaegerExporter();
  } else {
    exporter = new ZipkinExporter();
  }

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName
    }),
    spanProcessors: [
      new SimpleSpanProcessor(exporter),
    ],
  });

  registerInstrumentations({
    instrumentations: [
      new KoaInstrumentation(),
      new HttpInstrumentation(),
    ],
    tracerProvider: provider,
  });

  // Initialize the OpenTelemetry APIs to use the NodeTracerProvider bindings
  provider.register();

  return api.trace.getTracer(serviceName);
};
