QUOTA-SAFETY RULE

When the agent detects that the current session is approaching a practical
token/quota limit, it must NOT begin another large task.

It must first:

1. finish the current safe code operation,
2. run available tests,
3. save all files,
4. update CURRENT_IMPLEMENTATION_STATUS.md,
5. update CHANGELOG.md,
6. record the exact unfinished task,
7. record the exact files being modified,
8. record known errors,
9. record the next action,
10. leave the project in a buildable state whenever reasonably possible.

The next agent must be able to continue from these files without reconstructing
the previous conversation.