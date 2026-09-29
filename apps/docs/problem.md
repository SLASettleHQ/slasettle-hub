# Problem

An uptime SLA between a service provider and a customer is normally
enforced by trust and paperwork: the provider self-reports uptime, the
customer disputes it if they disagree, and any penalty gets negotiated or
litigated after the fact. Two things make this weak:

1. **The provider controls the evidence.** If the provider's own
   monitoring says uptime was fine, the customer has to prove otherwise.
2. **The penalty depends on the provider paying.** Even a clear breach
   requires the provider to actually pay, on their own initiative or after
   a dispute.

SLASettle's specific fix is narrow, not a general trust solution:

- The provider locks a real bond into a contract before the SLA starts.
  The penalty is not a future promise; the funds already exist and are
  already under the contract's control.
- Uptime is checked by a set of watchers who are not the provider, and
  who each report independently.
- Settlement (paying the penalty) can be triggered by anyone once a quorum
  of those watchers has voted the service down for a given round (nothing
  here triggers it automatically), without requiring the provider's, the beneficiary's, or an
  admin's permission at the moment of settlement.

This does not solve every trust problem. The current implementation has
real, disclosed limits (see [Limitations](/limitations)): watchers can
still copy each other's votes late in a round (no commit-reveal yet), and
there is currently one shared watcher set rather than a provider-curated
one. This documentation does not claim otherwise.
