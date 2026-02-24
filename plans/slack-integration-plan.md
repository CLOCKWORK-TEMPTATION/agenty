# Slack Integration Complete Implementation Plan

## Overview

This plan outlines the complete implementation of Slack integration for the Multi-Agent Platform, including Webhook handling, Bot commands, and Events processing.

## Current State Analysis

The existing implementation in [`apps/api/src/routes/integrations.ts`](apps/api/src/routes/integrations.ts) already provides:

- Basic Slack event handling (message, app_mention, team_join)
- Slash command handling (`/agent`)
- Interactive component handling (block_actions, view_submission)
- Signature verification with HMAC-SHA256
- Database tables for storing commands, mentions, and interactions

### What Needs Enhancement

1. **Types**: No dedicated TypeScript types for Slack payloads
2. **Modularity**: All integration logic is in one large file
3. **OAuth**: No OAuth flow for Slack app installation
4. **Outgoing Webhooks**: Limited notification capabilities
5. **Agent Integration**: Commands are stored but not processed
6. **Block Kit**: No structured Block Kit message builder

---

## Architecture

```mermaid
flowchart TB
    subgraph Slack Platform
        SE[Slack Events API]
        SC[Slash Commands]
        SI[Interactive Components]
        SO[Slack OAuth]
    end

    subgraph API Server
        subgraph Routes
            ER[/api/v1/integrations/slack/events]
            CR[/api/v1/integrations/slack/command]
            IR[/api/v1/integrations/slack/interactivity]
            OR[/api/v1/integrations/slack/oauth]
        end

        subgraph Slack Module
            SV[Signature Verifier]
            EH[Event Handler]
            CP[Command Processor]
            IB[Interaction Broker]
            MB[Message Builder]
            OM[Outgoing Messenger]
        end
    end

    subgraph Storage
        PG[(PostgreSQL)]
        RD[(Redis)]
    end

    subgraph Workers
        SW[Slack Notification Worker]
        CW[Command Processing Worker]
    end

    subgraph Agent System
        LG[LangGraph Orchestrator]
        TU[Tool Approval]
    end

    SE --> ER
    SC --> CR
    SI --> IR
    SO --> OR

    ER --> SV --> EH
    CR --> SV --> CP
    IR --> SV --> IB
    
    EH --> PG
    CP --> PG
    IB --> PG
    
    CP --> CW --> LG
    LG --> SW --> OM
    TU --> SW --> OM
    
    OM --> SE
    MB --> OM
```

---

## Implementation Tasks

### 1. Create Slack Integration Types

**File**: [`packages/types/src/index.ts`](packages/types/src/index.ts)

Add the following types:

```typescript
// Slack Integration Types
export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface SlackTokenResponse {
  access_token: string;
  token_type: string;
  bot_user_id: string;
  team_id: string;
  team_name: string;
  scope: string;
  app_id: string;
}

export interface SlackEventPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  event: SlackEvent;
  type: 'event_callback' | 'url_verification';
  challenge?: string;
  event_id: string;
  event_time: number;
}

export interface SlackEvent {
  type: string;
  user?: string;
  text?: string;
  channel?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
  subtype?: string;
  reaction?: string;
  item?: {
    type: string;
    channel?: string;
    ts?: string;
  };
}

export interface SlackSlashCommand {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  api_app_id: string;
}

export interface SlackInteractionPayload {
  type: 'block_actions' | 'view_submission' | 'view_closed' | 'shortcut';
  user: {
    id: string;
    username: string;
    name: string;
    team_id: string;
  };
  team?: {
    id: string;
    domain: string;
  };
  channel?: {
    id: string;
    name: string;
  };
  actions?: SlackBlockAction[];
  view?: SlackView;
  trigger_id?: string;
  response_url?: string;
}

export interface SlackBlockAction {
  action_id: string;
  block_id: string;
  type: string;
  value?: string;
  selected_option?: { text: { text: string }; value: string };
  selected_user?: string;
  selected_channel?: string;
}

export interface SlackView {
  id: string;
  callback_id: string;
  state: { values: Record<string, Record<string, { type: string; value?: string; selected_option?: { value: string } }>> };
  private_metadata?: string;
}

export interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  thread_ts?: string;
  reply_broadcast?: boolean;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

export interface SlackBlock {
  type: string;
  block_id?: string;
  text?: SlackTextObject;
  accessory?: SlackBlockElement;
  elements?: SlackBlockElement[];
  fields?: SlackTextObject[];
}

export interface SlackTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
  verbatim?: boolean;
}

export interface SlackBlockElement {
  type: string;
  action_id?: string;
  text?: SlackTextObject;
  value?: string;
  url?: string;
  style?: 'primary' | 'danger';
  confirm?: SlackConfirmationDialog;
  options?: Array<{ text: SlackTextObject; value: string }>;
  placeholder?: SlackTextObject;
  initial_option?: { text: SlackTextObject; value: string };
}

export interface SlackConfirmationDialog {
  title: SlackTextObject;
  text: SlackTextObject;
  confirm: SlackTextObject;
  deny: SlackTextObject;
}

export interface SlackAttachment {
  color?: string;
  fallback?: string;
  title?: string;
  text?: string;
  fields?: Array<{ title: string; value: string; short: boolean }>;
  actions?: Array<{ type: string; text: string; url?: string; style?: string }>;
}

export interface SlackInstallation {
  team_id: string;
  team_name: string;
  bot_user_id: string;
  bot_token: string;
  installed_at: string;
  installed_by: string;
  scopes: string[];
}
```

---

### 2. Create Dedicated Slack Integration Module

**File**: [`apps/api/src/integrations/slack.ts`](apps/api/src/integrations/slack.ts)

Create a modular Slack integration with:

```typescript
// Main exports
export const slackIntegrationPlugin: FastifyPluginAsync;

// Internal modules
export class SlackSignatureVerifier;
export class SlackEventHandler;
export class SlackCommandProcessor;
export class SlackInteractionBroker;
export class SlackMessageBuilder;
export class SlackOutgoingMessenger;
export class SlackOAuthManager;
```

---

### 3. Implement OAuth Flow

**Endpoints**:
- `GET /api/v1/integrations/slack/oauth/install` - Redirect to Slack OAuth
- `GET /api/v1/integrations/slack/oauth/callback` - Handle OAuth callback

**Flow**:
1. User clicks "Add to Slack" button
2. Redirect to Slack OAuth authorization page
3. User authorizes the app
4. Slack redirects back with code
5. Exchange code for bot token
6. Store installation in database

**Database Table**:
```sql
CREATE TABLE slack_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,
  team_name TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  bot_token TEXT NOT NULL, -- encrypted
  installed_by TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 4. Implement Outgoing Webhook System

**File**: [`apps/api/src/integrations/slack/messenger.ts`](apps/api/src/integrations/slack/messenger.ts)

**Features**:
- Send messages to channels
- Send ephemeral messages to users
- Update existing messages
- Delete messages
- Reply in threads
- Send rich Block Kit messages

**Notification Types**:
- Run started
- Run completed
- Run failed
- Tool approval required
- Tool approved/rejected
- Error alerts

---

### 5. Implement Slash Command Processor

**Commands**:
- `/agent run <task>` - Start a new agent run
- `/agent status [run_id]` - Check run status
- `/agent approve <run_id> <tool_id>` - Approve tool
- `/agent reject <run_id> <tool_id>` - Reject tool
- `/agent cancel <run_id>` - Cancel run
- `/agent help` - Show help

**Processing Flow**:
1. Receive command
2. Validate signature
3. Parse command and arguments
4. Execute action or queue for processing
5. Return immediate response
6. Send follow-up via response_url

---

### 6. Implement Event Subscription Management

**Supported Events**:
- `message` - Message posted in channel
- `app_mention` - Bot mentioned
- `team_join` - New user joined
- `reaction_added` - Reaction added to message
- `channel_created` - New channel created
- `channel_left` - Bot left channel

**Event Processing**:
1. Verify signature
2. Handle URL verification challenge
3. Parse event type
4. Route to appropriate handler
5. Store in database for audit
6. Trigger async processing if needed

---

### 7. Implement Message Builder with Block Kit Support

**File**: [`apps/api/src/integrations/slack/message-builder.ts`](apps/api/src/integrations/slack/message-builder.ts)

**Builder Pattern**:
```typescript
const message = new SlackMessageBuilder()
  .setChannel('C1234567890')
  .setText('Run completed')
  .addHeaderBlock('Run Completed Successfully')
  .addSectionBlock({
    text: '*Run ID:* run-123\n*Status:* completed',
  })
  .addDividerBlock()
  .addActionsBlock([
    { type: 'button', text: 'View Details', url: 'https://...' },
    { type: 'button', text: 'View Logs', url: 'https://...' },
  ])
  .build();
```

**Pre-built Templates**:
- Run status notification
- Tool approval request
- Error alert
- Welcome message
- Help message

---

### 8. Implement Modal Interactions

**Modals**:
- New run creation form
- Tool approval dialog
- Configuration settings
- Team selection

**Flow**:
1. User triggers modal (button or shortcut)
2. Open modal with `views.open` API
3. User submits form
4. Handle `view_submission` payload
5. Update or close modal

---

### 9. Create Slack Notification Worker

**File**: [`infra/workers/src/slack-notification-worker.ts`](infra/workers/src/slack-notification-worker.ts)

**Queue**: `slack-notifications`

**Job Types**:
- `send_message` - Send a message
- `update_message` - Update a message
- `send_ephemeral` - Send ephemeral message

**Features**:
- Rate limiting (respect Slack API limits)
- Retry with exponential backoff
- Dead letter queue for failed messages
- Batch processing for efficiency

---

### 10. Add Integration Tests

**File**: [`apps/api/test/integrations/slack.test.ts`](apps/api/test/integrations/slack.test.ts)

**Test Cases**:
- Signature verification
- URL verification challenge
- Event handling
- Slash command processing
- Interaction handling
- OAuth flow
- Message sending
- Block Kit building

---

### 11. Update Environment Variables

**File**: [`.env.example`](.env.example)

Add:
```
# Slack Integration
SLACK_CLIENT_ID=replace_me
SLACK_CLIENT_SECRET=replace_me
SLACK_SIGNING_SECRET=replace_me
SLACK_BOT_TOKEN=replace_me
SLACK_REDIRECT_URI=http://localhost:4000/api/v1/integrations/slack/oauth/callback
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/integrations/slack/events` | Handle Slack events |
| POST | `/api/v1/integrations/slack/command` | Handle slash commands |
| POST | `/api/v1/integrations/slack/interactivity` | Handle interactions |
| GET | `/api/v1/integrations/slack/oauth/install` | Start OAuth flow |
| GET | `/api/v1/integrations/slack/oauth/callback` | OAuth callback |
| POST | `/api/v1/integrations/slack/message` | Send message (internal) |
| GET | `/api/v1/integrations/slack/installations` | List installations |
| DELETE | `/api/v1/integrations/slack/installations/:team_id` | Uninstall app |

---

## Database Schema Additions

```sql
-- Slack installations
CREATE TABLE slack_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,
  team_name TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  bot_token TEXT NOT NULL,
  installed_by TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Slack notification queue
CREATE TABLE slack_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Add indexes
CREATE INDEX idx_slack_commands_status ON slack_commands(status);
CREATE INDEX idx_slack_mentions_status ON slack_mentions(status);
CREATE INDEX idx_slack_notification_queue_status ON slack_notification_queue(status);
```

---

## Security Considerations

1. **Signature Verification**: All incoming requests must be verified
2. **Token Encryption**: Bot tokens stored encrypted in database
3. **Rate Limiting**: Respect Slack API rate limits
4. **Input Validation**: Validate all incoming payloads
5. **Audit Logging**: Log all integration actions
6. **Least Privilege**: Request minimal OAuth scopes

---

## Implementation Order

1. Create types in packages/types
2. Create dedicated Slack module
3. Implement OAuth flow
4. Enhance event handling
5. Implement command processor
6. Add message builder
7. Create notification worker
8. Add modal interactions
9. Write tests
10. Update documentation

---

## Success Criteria

- [ ] All Slack events properly handled and verified
- [ ] Slash commands process and respond correctly
- [ ] OAuth flow works for app installation
- [ ] Notifications sent for run events
- [ ] Tool approvals work via Slack
- [ ] Block Kit messages render correctly
- [ ] All tests passing
- [ ] Documentation complete
