# OB Account Migration Protocol

Every new AI Studio account must assume that it has no access to the previous
conversation.

The uploaded project ZIP plus the .ai directory must therefore contain enough
information to reconstruct project state.

Before implementation, every new account must:

1. Read the .ai documentation.
2. Inspect the source tree.
3. Read CURRENT_IMPLEMENTATION_STATUS.md.
4. Read CHANGELOG.md.
5. Identify the previous completed phase.
6. Verify important previous-phase functionality.
7. Identify incomplete work.
8. Implement only the assigned phase.
9. Test the implementation.
10. Update CURRENT_IMPLEMENTATION_STATUS.md.
11. Update CHANGELOG.md.
12. Leave the project in a recoverable state.
13. Save the project before quota exhaustion.