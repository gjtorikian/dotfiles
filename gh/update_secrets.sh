#!/usr/bin/env sh

set -e

TOKE=""

gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/html-pipeline
gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/html-proofer
gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/tailwind_merge
gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/commonmarker
gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/what_you_say
gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/mathematical
gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/heroicons_helper
gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/selma
gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/slack_webhook_logger
gh secret set PUBLIC_PUSH_TO_PROTECTED_BRANCH --body "$TOKE" -R gjtorikian/bs62
