# Data backup (S3)

Local CSV and other files under `data/dev` and `data/prod` can be mirrored to S3 using the AWS CLI and IAM Identity Center (SSO).

## Prerequisites

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed
- Permission to use the organization’s SSO portal and the target S3 buckets

## One-time: configure SSO

Run:

```bash
aws configure sso
```

When prompted, use:

| Prompt | Value |
|--------|--------|
| SSO session name | `sso_maksymchuk` |
| SSO start URL | *(your org’s SSO portal URL)* |
| SSO region | `ca-central-1` |
| SSO registration scopes | *(defaults are usually fine; press Enter)* |

After browser login, pick the account and role that can access the leads buckets, then:

| Prompt | Value |
|--------|--------|
| CLI default client Region | `ca-central-1` |
| CLI default output format | `json` |

If `aws configure sso` fails to connect to `https://oidc.ca-central-1.amazonaws.com`, fix network/VPN/proxy access to AWS first.

## Sync to S3

Run these from the **repository root** (adjust the path if your clone lives elsewhere).

**Development data**

```bash
aws s3 sync ./data/dev s3://maksymchuk-leads-dev/data/ --delete
```

**Production data**

```bash
aws s3 sync ./data/prod s3://maksymchuk-leads-prod/data/ --delete
```

`--delete` removes objects in the bucket that are not present locally, so the bucket matches your folder. Omit `--delete` if you only want to add/update files and leave extra remote objects alone.

## Refreshing SSO login

When the session expires:

```bash
aws sso login --profile <profile-name>
```

Use the same profile name you configured (shown in `~/.aws/config` after SSO setup).
