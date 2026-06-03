# Vendored VeChain AI Skills

These are **vendored copies** of skills from the official
[`vechain/vechain-ai-skills`](https://github.com/vechain/vechain-ai-skills) repository
(the `vechain-ai` plugin). They live here under `.claude/skills/` so Claude Code
auto-discovers and loads them for everyone working in this repo — no per-machine
install needed, and the exact versions are pinned in git.

## Provenance

| | |
|---|---|
| Upstream | https://github.com/vechain/vechain-ai-skills |
| Plugin | `vechain-ai` v0.3.0 |
| Vendored from commit | `a9fc7ef` (2026-05-29) |
| Vendored on | 2026-06-02 |

## Why a subset?

The upstream plugin ships **16 skills**. We vendored only the ones that map to what
TRACE actually does:

| Skill | Why it's here |
|-------|---------------|
| `vechain-core` | SDK usage, **VIP-191 fee delegation**, multi-clause txns — exactly the anchor-worker path ([packages/api/src/workers/anchor-passport.worker.ts](../../packages/api/src/workers/anchor-passport.worker.ts)). |
| `smart-contract-development` | Solidity/Hardhat on VeChainThor, EVM target `paris`, UUPS, ABI/TypeChain codegen, security — for [packages/contracts/](../../packages/contracts/). |
| `thor` | Thor node internals + **Solo mode** (our Docker dev node), built-in contracts, REST API. |
| `secure-github-actions` | SHA-pinning, least-privilege `permissions:`, safe `run:` — our deploy workflows hold SSH secrets. |
| `frontend` | React Query / TanStack patterns and transaction UX for [packages/web/](../../packages/web/). |

Skills intentionally **not** vendored (don't apply to TRACE): `vechain-kit`,
`create-vechain-dapp`, `vebetterdao`, `vebetterdao-navigators`, `stargate`,
`x-2-earn-apps`, `vechain-react-native-dev`, `translate`, `indexer-core`,
`auto-voting-relayers`, `grill-me`.

## Re-syncing with upstream

These are static copies — they do not auto-update. To refresh:

```bash
# Option A: universal Skills CLI
npx skills add vechain/vechain-ai-skills

# Option B: re-copy from a fresh clone (preserves our subset)
git clone --depth 1 https://github.com/vechain/vechain-ai-skills.git /tmp/vechain-ai-skills
for s in vechain-core smart-contract-development thor secure-github-actions frontend; do
  rm -rf ".claude/skills/$s" && cp -r "/tmp/vechain-ai-skills/skills/$s" ".claude/skills/$s"
done
```

After re-syncing, update the **Provenance** table above with the new commit/date.
