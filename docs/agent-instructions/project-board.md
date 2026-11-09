# Working with the project board

The [project board](https://github.com/users/neumaennl/projects/1) holds the roadmap of the issues of this repository that are planned, together with those of the application that uses it. Its README explains the board for people; this file says how agents use it.

## Rules

- **Ask first.** Change statuses, fields, the order or relationships only with the maintainer's approval. The one exception: when you start approved work on an issue, move it to "In Progress".
- **Find the next work** in the "Ready" column, from top to bottom. The manual order is the priority.
- **Status:**
  - Backlog: blocked by an open issue, or not to be started yet.
  - Ready: no open "blocked by" issue, and planned to be done now. A blocked issue is never in Ready.
  - In Progress: being worked on.
  - Review: waiting for review.
  - Done: finished.
- **Parent issues** follow the same rules, judged by their work as a whole, not by single sub-issues. A parent goes to Review when all its sub-issues are done, so that a reviewer can check that nothing was forgotten and that the parts fit together; if something is missing, the parent gets a new sub-issue.
- **Phase:** the field "Phase" belongs to the application's roadmap. Issues of this repository have no phase.
- **Order:** a parent comes before its sub-issues. Only the maintainer decides the order.
- **Relationships:** parent and sub-issue group the work (one parent per issue), "blocked by" sets the order (also across repositories), "relates to" connects issues without an order. Before you create new issues, add the relationships that are already known between existing issues.
- **New issues for known issues:** an entry of [the known issues](../known-issues.md) gets a GitHub issue when its work is planned. The issue takes the entry's heading as title and links the entry; the entry then links the issue.
- **No tool footers:** do not add footers that advertise the agent or tool, such as "Generated with …", to issues, comments or pull requests.

## Reading and changing the board

Use the GitHub GraphQL API, for example with `gh api graphql`. It needs a token with the `project` scope. If you cannot access the board, tell the maintainer.

Read the items in their manual order, with their status (the API returns at most 100 items per request; use `after` with `pageInfo.endCursor` for more):

```graphql
{
  user(login: "neumaennl") {
    projectV2(number: 1) {
      items(first: 100) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content { ... on Issue { number title state repository { name } } }
          status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
        }
      }
    }
  }
}
```

| To | Use |
|---|---|
| Add an issue to the board | `gh project item-add 1 --owner neumaennl --url <issue URL>` |
| Set the status | `updateProjectV2ItemFieldValue` with the field ID and the option ID (`gh project field-list 1 --owner neumaennl`) |
| Move an item | `updateProjectV2ItemPosition` with `afterId`, or without it to move the item to the top |
| Read relationships | the fields `parent`, `subIssues`, `blockedBy`, `blocking` and `relatesTo` of an issue |
| Change relationships | `addSubIssue`, `addBlockedBy`, `addRelatesTo`, and `removeSubIssue`, `removeBlockedBy`, `removeRelatesTo` |
