# Workflow portals storyboard

Clickable wireframes that show where the workflow runtime's two business-facing contexts, the **admin context**
and the **user inbox**, live relative to the **Integration Control Plane (ICP)**, and why they are not part of it.

One leave-request instance is shown from every surface, so the difference between the personas is visible rather
than argued. Nothing is backed by a runtime; the only state is the two clicks of the scenario (reassign, approve).

The published page is encrypted. `index.html` holds only ciphertext and a password prompt; the storyboard is
decrypted in the browser (AES-256-GCM, key derived from the password with PBKDF2, WebCrypto). The sources live in
`src/`, which is not committed, and the password is never in the repository.

```sh
STORYBOARD_PASSWORD='…' node build.mjs   # bundles src/ into index.html, encrypted
```

Commit the generated `index.html` and push; GitHub Pages serves it from `main`. The site carries `noindex` and
`robots.txt` as well, but the encryption is what keeps the content out of search engines.

## What is in it

| Page | Shows |
|---|---|
| Overview | The two cases, the two modelling variations, the three surfaces and the four-sentence argument |
| Case 1 · ICP only | DevOps, runtime management and workflow administration (instances, human tasks, admin actions) inside the ICP, drawn in its theme, with pros and cons |
| Case 2 · ICP + portals | The ICP keeps DevOps and runtime management (environments, registration, namespaces, scaling, logs, counters) and links to the admin context and inbox served by each environment's runtime; pros and cons |
| Runtime modelling | Orthogonal to the cases: the runtime as a separate entity with its own item, or as a runtime kind `workflow_runtime` under Runtimes like MI; pros, cons, recommendation |
| Admin context | One environment's instances; the stuck request; reassign, pause, resume, terminate, retry, audit |
| User inbox | The delegate's inbox and the approval form |
| Own portal | A customer's HR app embedding "My approvals" on the same APIs |
| Why | The argument in full, a side-by-side table, and answers to the usual follow-ups |

**Walk the scenario** steps through the surfaces with the same instance highlighted on each.

## The argument in four lines

1. **Environment.** The ICP spans environments; the portals are per environment. A production approval has no dev
   or staging counterpart, so an "all environments" inbox has no definition.
2. **Persona.** DevOps asks whether the runtime is healthy and which version runs. Business operations ask why a
   request is stuck and who can unblock it. Business users ask what is waiting for them.
3. **Scaling.** The ICP is sized for a few operators on one or two nodes. The portals scale with the workflow load
   and with the number of people in the business.
4. **Versioning.** Each environment runs its own runtime version, so its own portal UI and API version. A portal
   served by the runtime is always version-matched; one compiled into the ICP must carry every version at once.

DevOps functions stay in the ICP: environments, runtime registration, namespaces, scaling, logs, metrics, access
control. Workflow functions come from the runtime of each environment, behind its own URL.

The admin context and the inbox are one deployable with two contexts on the same APIs; the role decides which
one a user gets. Teams that want their own UI use the same APIs and skip the shipped portals.

## Legacy

`legacy/management-dashboard/` holds the earlier React dashboard that drives a live `workflow.management` API. It
still runs on its own (`npm install && npm run dev` inside that folder) and is unrelated to the storyboard.
