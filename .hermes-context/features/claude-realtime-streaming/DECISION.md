# Decisions
Use existing SSE transport and CLI execution architecture; no replacement SDK/service. Isolate sessions/tests from production data.
Use content_sync to replace canonical text/thinking on correction or abandoned attempt; normal delta remains append-only. Current flat UI excludes child-agent content rather than mixing it into root; separate child rows remain out of scope. Reference VSCode artifact 2.1.308 and installed CLI 2.1.302 are explicitly distinct.
No version bump/release without explicit request.
