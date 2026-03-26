#!/usr/bin/env node
/**
 * Kafka worker: consumes xdr.raw.endpoint and runs the existing pipeline:
 * raw_events insert (already done by API) → normalize → IOC → detect → alerts.
 *
 * This is Phase 1 plumbing: it lets us move heavy work off the request path and later
 * extend to multi-source telemetry.
 */
require('dotenv').config();

const config = require('../config');
const logger = require('../utils/logger');
const { createConsumer, isEnabled } = require('../kafka/kafkaClient');
const { topics } = require('../kafka/topics');
const EventIngestionService = require('../services/EventIngestionService');
const KafkaProducer = require('../kafka/producer');
const EndpointService = require('../services/EndpointService');
const { XdrEventSchema } = require('../xdr/xdrSchema');
const { fromLegacyRawEventRow, mkIngestId } = require('../xdr/xdrMapper');
const { insertXdrEvent } = require('../xdr/xdrStore');

async function main() {
  if (!isEnabled()) {
    logger.info('Kafka disabled (set KAFKA_ENABLED=true). Exiting.');
    process.exit(0);
  }

  const consumer = await createConsumer({ groupId: config.kafka.groupId || 'ironshield-workers' });
  const t = topics();
  const topicList = [t.rawEndpoint, t.rawWeb, t.rawAuth, t.rawZeek].filter(Boolean);
  for (const topic of topicList) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  logger.info({ topics: topicList }, 'Kafka raw ingest worker started');

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const s = message.value?.toString('utf8') || '';
        const payload = JSON.parse(s);
        const ingestId = mkIngestId();

        // Common insert+publish helper
        const put = async (xdr) => {
          const parsed = XdrEventSchema.safeParse(xdr);
          if (!parsed.success) return null;
          const xdrId = await insertXdrEvent(parsed.data);
          await KafkaProducer.publishNormalizedEvent({
            xdr_event_id: xdrId,
            tenant_id: parsed.data.tenant_id ?? null,
            endpoint_id: parsed.data.endpoint_id ?? null,
            ingest_id: parsed.data.ingest_id ?? null,
            source: parsed.data.source,
            event_type: parsed.data.event_type,
          });
          return xdrId;
        };

        // Endpoint batches
        if (payload.endpoint_id && Array.isArray(payload.events)) {
          const endpointId = payload.endpoint_id;
          const n = Math.min(Number(payload.count || payload.events.length || 100) || 100, 200);
          const endpoint = await EndpointService.getById(endpointId, null).catch(() => null);
          const tenantId = endpoint?.tenant_id ?? null;

          for (const evt of payload.events.slice(0, n)) {
            const fakeRow = {
              id: null,
              endpoint_id: endpointId,
              hostname: evt.hostname || endpoint?.hostname || null,
              event_source: evt.event_source || null,
              event_type: evt.event_type || null,
              timestamp: evt.timestamp || payload.received_at || new Date().toISOString(),
              raw_event_json: evt,
            };
            const xdr = fromLegacyRawEventRow(fakeRow, { tenantId, ingestId });
            await put(xdr);
          }

          // Legacy pipeline continuity
          const processed = await EventIngestionService.processUnprocessed(endpointId, n);
          logger.debug({ endpointId, processed, ingestId }, 'Kafka endpoint batch processed');
          return;
        }

        // Web/auth/zeek producers post already-normalized-ish records. We store raw_json and minimal fields.
        const src = payload.source;
        if (src === 'web' || src === 'auth' || src === 'zeek') {
          const xdr = {
            tenant_id: payload.tenant_id ?? null,
            endpoint_id: payload.endpoint_id ?? null,
            event_id: payload.event_id ?? null,
            timestamp: payload.timestamp || payload.received_at || new Date().toISOString(),
            source: src,
            event_type: payload.event_type ?? null,
            user_name: payload.user_name ?? payload.user ?? null,
            host_name: payload.host_name ?? payload.host ?? null,
            source_ip: payload.source_ip ?? null,
            destination_ip: payload.destination_ip ?? null,
            destination_port: payload.destination_port ?? null,
            protocol: payload.protocol ?? null,
            dns_query: payload.dns_query ?? null,
            action: payload.action ?? null,
            ingest_id: payload.ingest_id ?? ingestId,
            metadata_json: payload.metadata ?? payload.metadata_json ?? null,
            raw_json: payload.raw ?? payload.raw_json ?? payload,
          };
          await put(xdr);
          logger.debug({ source: src, ingestId }, 'Kafka non-endpoint event stored');
          return;
        }
      } catch (e) {
        logger.warn({ err: e.message }, 'Kafka message processing failed');
      }
    },
  });
}

main().catch((e) => {
  logger.error({ err: e.message }, 'Kafka worker crashed');
  process.exit(1);
});

