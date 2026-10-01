#!/usr/bin/env bash
set -u
curl --max-time 60 -fsS -X POST 'http://127.0.0.1:3000/api/trpc/chat.complete?batch=1' \
  -H 'content-type: application/json' \
  --data-raw '{"0":{"json":{"model":"ollama:smollm2:135m","messages":[{"role":"user","content":"قل مرحبا"}]}}}' \
  -o /tmp/chatbro-smoke-local.json
status=$?
echo "STATUS=$status"
wc -c /tmp/chatbro-smoke-local.json 2>/dev/null || true
head -c 1500 /tmp/chatbro-smoke-local.json 2>/dev/null || true
printf '\n'
