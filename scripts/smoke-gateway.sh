#!/usr/bin/env bash
set -e
curl --max-time 60 -fsS -X POST 'http://127.0.0.1:3000/api/trpc/chat.complete?batch=1' \
  -H 'content-type: application/json' \
  --data-raw '{"0":{"json":{"model":"gateway:kilo:kilo-auto/free","messages":[{"role":"user","content":"Reply with one word: hello"}]}}}' \
  -o /tmp/chatbro-smoke-gateway.json
wc -c /tmp/chatbro-smoke-gateway.json
head -c 1500 /tmp/chatbro-smoke-gateway.json
printf '\n'
