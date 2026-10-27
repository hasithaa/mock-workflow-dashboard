# Workflow portals storyboard

Clickable wireframes that show where the workflow runtime's two business-facing contexts, the **admin context**
and the **user inbox**, live relative to the **Integration Control Plane (ICP)**, and why they are not part of it.

One leave-request instance is shown from every surface, so the difference between the personas is visible rather
than argued. Nothing is backed by a runtime; the only state is the two clicks of the scenario (reassign, approve).

Open `index.html` in a browser, or serve the folder with any static server. No build step.

## What is in it

| Page | Shows |
|---|---|
| Overview | The three surfaces and the three-sentence argument |
| ICP | In the ICP's own theme: one card per environment with the runtime (version, nodes, database, namespaces), version-matched portal links and read-only counters |
| Admin context | One environment's instances; the stuck request; reassign, pause, resume, terminate, retry, audit |
| User inbox | The delegate's inbox and the approval form |
| Own portal | A customer's HR app embedding "My approvals" on the same APIs |
| Today | The Workflows page the ICP ships now (environment picker, User Actions / Admin Actions), with what is wrong about keeping it there |
| Placement | Where the workflow runtime appears in the ICP: under Runtimes like MI, or its own item; pros, cons, recommendation |
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
