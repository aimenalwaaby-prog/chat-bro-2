#!/usr/bin/env bash
set -e
curl --max-time 90 -fsS -X POST 'http://127.0.0.1:3000/api/trpc/chat.complete?batch=1' \
  -H 'content-type: application/json' \
  --data-raw '{"0":{"json":{"model":"gemini-3-flash-preview","messages":[{"role":"user","content":"Reply with one short word: hello"}]}}}' \
  -o /tmp/chatbro-smoke-cloud.json
wc -c /tmp/chatbro-smoke-cloud.json
head -c 1500 /tmp/chatbro-smoke-cloud.json
printf '\n'
