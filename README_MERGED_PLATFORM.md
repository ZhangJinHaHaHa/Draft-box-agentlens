# AgentLens merged platform package

This archive contains the merged AgentLens platform source.

Included:

- `agent-web3-main-f46e7eca3cb6f52c933448f0c44655810b9adec8/`: merged main project.
- `agentlens_task_knowledge_graph.md`: task knowledge graph and migration notes.
- `agentlens-elevenlabs-smoke.png`: smoke-test screenshot.

Not included:

- `node_modules/`
- `dist/`
- TypeScript build cache files
- macOS `__MACOSX` metadata

Run frontend locally:

```bash
cd agent-web3-main-f46e7eca3cb6f52c933448f0c44655810b9adec8/frontend
npm install
npm run dev
```

Verification already completed before packaging:

- `npm run build`
- `npm test`
- Browser smoke test for `/zh`, `/zh/agents`, `/zh/agent/elevenlabs`, and audit report error state.
