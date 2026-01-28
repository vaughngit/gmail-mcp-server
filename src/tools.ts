import { gmail_v1 } from "googleapis";
import { getGmailClient } from "./oauth.js";

type Gmail = gmail_v1.Gmail;

/**
 * Decodes base64url encoded content
 */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

/**
 * Extracts the body content from a message payload
 */
function extractBody(payload: gmail_v1.Schema$MessagePart): { text: string; html: string } {
  let text = "";
  let html = "";

  function processPayload(part: gmail_v1.Schema$MessagePart): void {
    if (part.body?.data) {
      const content = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/plain") {
        text = content;
      } else if (part.mimeType === "text/html") {
        html = content;
      }
    }

    if (part.parts) {
      for (const subPart of part.parts) {
        processPayload(subPart);
      }
    }
  }

  processPayload(payload);
  return { text, html };
}

/**
 * Gets a header value from a message
 */
function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return "";
  const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

/**
 * List messages in the mailbox
 */
export async function listMessages(params: {
  maxResults?: number;
  labelIds?: string[];
  q?: string;
  pageToken?: string;
}): Promise<{
  messages: Array<{
    id: string;
    threadId: string;
    snippet: string;
    from: string;
    subject: string;
    date: string;
    labelIds: string[];
  }>;
  nextPageToken?: string;
}> {
  const gmail = await getGmailClient();

  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults: params.maxResults || 20,
    labelIds: params.labelIds,
    q: params.q,
    pageToken: params.pageToken,
  });

  const messages = [];

  if (response.data.messages) {
    for (const msg of response.data.messages) {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });

      messages.push({
        id: msg.id!,
        threadId: msg.threadId!,
        snippet: detail.data.snippet || "",
        from: getHeader(detail.data.payload?.headers, "From"),
        subject: getHeader(detail.data.payload?.headers, "Subject"),
        date: getHeader(detail.data.payload?.headers, "Date"),
        labelIds: detail.data.labelIds || [],
      });
    }
  }

  return {
    messages,
    nextPageToken: response.data.nextPageToken || undefined,
  };
}

/**
 * Read a specific message
 */
export async function readMessage(params: {
  messageId: string;
}): Promise<{
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  body: string;
  htmlBody: string;
  labelIds: string[];
  attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }>;
}> {
  const gmail = await getGmailClient();

  const response = await gmail.users.messages.get({
    userId: "me",
    id: params.messageId,
    format: "full",
  });

  const headers = response.data.payload?.headers;
  const { text, html } = extractBody(response.data.payload!);

  // Extract attachments
  const attachments: Array<{
    filename: string;
    mimeType: string;
    size: number;
    attachmentId: string;
  }> = [];

  function findAttachments(part: gmail_v1.Schema$MessagePart): void {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
      });
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        findAttachments(subPart);
      }
    }
  }

  if (response.data.payload) {
    findAttachments(response.data.payload);
  }

  return {
    id: response.data.id!,
    threadId: response.data.threadId!,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    cc: getHeader(headers, "Cc"),
    subject: getHeader(headers, "Subject"),
    date: getHeader(headers, "Date"),
    body: text,
    htmlBody: html,
    labelIds: response.data.labelIds || [],
    attachments,
  };
}

/**
 * Search messages using Gmail query syntax
 */
export async function searchMessages(params: {
  query: string;
  maxResults?: number;
  pageToken?: string;
}): Promise<{
  messages: Array<{
    id: string;
    threadId: string;
    snippet: string;
    from: string;
    subject: string;
    date: string;
  }>;
  nextPageToken?: string;
}> {
  return listMessages({
    q: params.query,
    maxResults: params.maxResults,
    pageToken: params.pageToken,
  });
}

/**
 * Send an email
 */
export async function sendMessage(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  threadId?: string;
}): Promise<{ id: string; threadId: string }> {
  const gmail = await getGmailClient();

  // Build RFC 2822 formatted email
  const messageParts = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];

  if (params.cc) {
    messageParts.splice(1, 0, `Cc: ${params.cc}`);
  }

  if (params.bcc) {
    messageParts.splice(1, 0, `Bcc: ${params.bcc}`);
  }

  messageParts.push("", params.body);

  const message = messageParts.join("\r\n");
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      threadId: params.threadId,
    },
  });

  return {
    id: response.data.id!,
    threadId: response.data.threadId!,
  };
}

/**
 * Modify message labels
 */
export async function modifyMessage(params: {
  messageId: string;
  addLabelIds?: string[];
  removeLabelIds?: string[];
}): Promise<{ id: string; labelIds: string[] }> {
  const gmail = await getGmailClient();

  const response = await gmail.users.messages.modify({
    userId: "me",
    id: params.messageId,
    requestBody: {
      addLabelIds: params.addLabelIds,
      removeLabelIds: params.removeLabelIds,
    },
  });

  return {
    id: response.data.id!,
    labelIds: response.data.labelIds || [],
  };
}

/**
 * List all labels
 */
export async function listLabels(): Promise<
  Array<{
    id: string;
    name: string;
    type: string;
    messageListVisibility?: string;
    labelListVisibility?: string;
  }>
> {
  const gmail = await getGmailClient();

  const response = await gmail.users.labels.list({
    userId: "me",
  });

  return (response.data.labels || []).map((label) => ({
    id: label.id!,
    name: label.name!,
    type: label.type!,
    messageListVisibility: label.messageListVisibility || undefined,
    labelListVisibility: label.labelListVisibility || undefined,
  }));
}

/**
 * Create a new label
 */
export async function createLabel(params: {
  name: string;
  messageListVisibility?: "show" | "hide";
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
}): Promise<{
  id: string;
  name: string;
}> {
  const gmail = await getGmailClient();

  const response = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: params.name,
      messageListVisibility: params.messageListVisibility,
      labelListVisibility: params.labelListVisibility,
    },
  });

  return {
    id: response.data.id!,
    name: response.data.name!,
  };
}

/**
 * Create a draft
 */
export async function createDraft(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  threadId?: string;
}): Promise<{ id: string; messageId: string }> {
  const gmail = await getGmailClient();

  // Build RFC 2822 formatted email
  const messageParts = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];

  if (params.cc) {
    messageParts.splice(1, 0, `Cc: ${params.cc}`);
  }

  if (params.bcc) {
    messageParts.splice(1, 0, `Bcc: ${params.bcc}`);
  }

  messageParts.push("", params.body);

  const message = messageParts.join("\r\n");
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const response = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: encodedMessage,
        threadId: params.threadId,
      },
    },
  });

  return {
    id: response.data.id!,
    messageId: response.data.message?.id || "",
  };
}

/**
 * Send an existing draft
 */
export async function sendDraft(params: {
  draftId: string;
}): Promise<{ id: string; threadId: string }> {
  const gmail = await getGmailClient();

  const response = await gmail.users.drafts.send({
    userId: "me",
    requestBody: {
      id: params.draftId,
    },
  });

  return {
    id: response.data.id!,
    threadId: response.data.threadId!,
  };
}
