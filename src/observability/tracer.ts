import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify'

// O SDK precisa ser inicializado ANTES de qualquer outro import da aplicação.
// O OTel usa monkey-patching: intercepta os módulos http e fastify do Node.js
// no momento em que são carregados. Se o Fastify já tiver sido importado antes,
// a instrumentação não funciona — os spans não são criados.
const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'platform-core',
    [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version ?? '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318'}/v1/traces`,
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new FastifyInstrumentation(),
  ],
})

sdk.start()

// Garante shutdown limpo do SDK junto com o processo
process.on('SIGTERM', async () => {
  await sdk.shutdown()
})

export default sdk