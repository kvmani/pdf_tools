# Working agreement

- Read `docs/EDITOR_PROGRESS.md` before continuing editor work. Update it at each meaningful milestone with completed work, checks, limitations, and the next concrete steps.
- The user explicitly requests continuous commits and pushes to `main`. Keep commits small and working, run relevant checks, update the ledger, and push each milestone. Never force-push. Fetch before pushing; preserve concurrent work and resolve differences safely. Report a rejected or unavailable push explicitly.
- At interruption boundaries, record incomplete work and reproduction commands in the ledger. Do not mark an unfinished feature complete.
- The editor must work on an air-gapped intranet: vendor runtime browser assets; no CDN, telemetry, hosted services, OCR, or certificate-signing dependencies.
- Signatures mean user-placed signature images (and optional freehand ink), merged into the exported PDF. They are not cryptographic signatures.
- Existing-text editing is intentionally restricted to supported simple standard-font text. Never silently replace unsupported text with a covering rectangle.
- Preserve the standalone Flask workflow and existing merge/extract routes. Do not introduce a required portal or unrelated service.

