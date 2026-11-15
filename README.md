# zkVerify Proof Gatekeeper agent

Public repository for the Proof Gatekeeper track of zkVerify Agent Games 2026.

## Status

This is an **integration scaffold, not a competition-ready agent**. It implements the HTTP transport and signed preflight. It deliberately refuses scored tasks until the task-specific zkVerify proof verifier and the Gatekeeper decision-proof generator are implemented from the official circuit schema. Do not register it for scored rounds yet.

The official task contract requires a public HTTPS endpoint, raw-body HMAC verification, signed responses, a Groth16 proof for each provable decision, and confirmation that the incoming proof reached Finalized. The public build guide does not publish the Gatekeeper circuit witness schema, so this repository does not fabricate proofs or claim that a field-only check is sufficient.

## Requirements

- Node.js 20+
- Public HTTPS hosting that stays awake
- The platform's `AGENT_GAMES_HMAC_SECRET`, set only in the host's secret manager

Never commit `.env`, API keys, wallet seeds, or the one-time HMAC secret.

## Local setup

```sh
npm install
cp .env.example .env
# Set AGENT_GAMES_HMAC_SECRET in .env for local work
npm run dev
```

Health check: `GET /health`  
Agent handler: `POST /agent`

The endpoint is plain HTTP locally. Use HTTPS through your hosting provider in production and register the complete URL ending in `/agent`.

## Current behavior

- Verifies `x-agent-games-signature` against the raw request body before JSON parsing.
- Signs every response body with `x-agent-games-signature`.
- Answers the official `agent-games.preflight.v1` handshake.
- Returns a signed `503 proof_pipeline_not_configured` for scored tasks. This is intentional: returning an invented or invalid proof would be misleading and would fail scoring.

## Work required before competition

1. Implement source-proof lookup/finality confirmation using the official zkVerify interface.
2. Map the official Gatekeeper circuit witness and public signals; generate and locally verify the decision proof with the supplied WASM and proving key.
3. Return the exact event response schema, including proof and public signals where required.
4. Exercise every published trap in Practice Mode, then deploy and pass signed preflight.

Official references:
- https://agentgames.zkverify.io/build
- https://agentgames.zkverify.io/events/proof-gatekeeper
- https://agentgames.zkverify.io/rules
